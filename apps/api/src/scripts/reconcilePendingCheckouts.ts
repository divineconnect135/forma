import "dotenv/config";
import process from "node:process";

import { connectDatabase, disconnectDatabase } from "../config/database.js";

import { env } from "../config/env.js";
import { Order } from "../models/Order.js";

import {
  expireStripeSession,
  retrieveStripeSession,
} from "../services/stripe.service.js";

import { settleStripeSession } from "../services/orderSettlement.service.js";

const BATCH_SIZE = 50;

async function reconcilePendingCheckouts() {
  if (env.NODE_ENV === "production") {
    throw new Error("Use a production-controlled reconciliation job");
  }

  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    throw new Error("Stripe test configuration is required");
  }

  await connectDatabase(env.MONGODB_URI);

  try {
    // Check all active pending orders, even when
    // their reservation has not expired yet.
    const pending = await Order.find({
      status: "pending_payment",
      reservationStatus: "active",
    })
      .sort({ createdAt: 1 })
      .limit(BATCH_SIZE)
      .lean();

    console.log(`Found ${pending.length} pending orders to check.`);

    const results = {
      paid: 0,
      expired: 0,
      cancelled: 0,
      stillPending: 0,
      skipped: 0,
      failed: 0,
    };

    for (const order of pending) {
      const sessionId = order.stripeCheckoutSessionId;

      console.log(`\nChecking order: ${order.orderNumber}`);

      if (!sessionId) {
        console.warn("No saved Stripe Session ID. Manual review required.");

        results.skipped++;
        continue;
      }

      try {
        // Always retrieve the current status from Stripe.
        let stripeSession = await retrieveStripeSession(sessionId);

        console.log("Stripe session:", stripeSession.status);

        console.log("Stripe payment:", stripeSession.payment_status);

        // Expire an open Stripe Session only when
        // its Stripe expiration time has passed.
        const expiredByTime = stripeSession.expires_at * 1000 <= Date.now();

        if (stripeSession.status === "open" && expiredByTime) {
          try {
            stripeSession = await expireStripeSession(sessionId);
          } catch {
            // Session could have completed
            // concurrently. Retrieve it again.
            stripeSession = await retrieveStripeSession(sessionId);
          }
        }

        // The settlement service validates the
        // Stripe order identity, payment amount,
        // currency, and inventory transaction.
        const outcome = await settleStripeSession(
          stripeSession,
          "reconciliation",
        );

        console.log("Reconciliation result:", outcome);

        switch (outcome) {
          case "paid":
            results.paid++;
            break;

          case "expired":
            results.expired++;
            break;

          case "cancelled":
            results.cancelled++;
            break;

          case "pending":
            results.stillPending++;
            break;

          case "already-finalized":
          case "ignored":
            results.skipped++;
            break;
        }
      } catch (error) {
        console.error(`Failed to reconcile ${order.orderNumber}:`, error);

        results.failed++;
      }
    }

    console.log("\nReconciliation summary:");
    console.log(results);

    if (results.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await disconnectDatabase();
  }
}

reconcilePendingCheckouts().catch((error: unknown) => {
  console.error("Reconciliation failed:", error);

  process.exitCode = 1;
});
