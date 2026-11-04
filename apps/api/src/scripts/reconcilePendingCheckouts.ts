import "dotenv/config";
import process from "node:process";

import { connectDatabase, disconnectDatabase } from "../config/database.js";

import { env } from "../config/env.js";
import { Order } from "../models/Order.js";

import {
  recoverCheckoutOrder,
  CheckoutRecoveryError,
} from "../services/checkoutRecovery.service.js";

const BATCH_SIZE = 50;

async function reconcilePendingCheckouts() {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "Production reconciliation requires a managed scheduler and monitoring.",
    );
  }

  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    throw new Error("Stripe test configuration is required.");
  }

  await connectDatabase(env.MONGODB_URI);

  try {
    const orders = await Order.find({
      status: "pending_payment",
      reservationStatus: "active",
    })
      .sort({
        createdAt: 1,
        _id: 1,
      })
      .limit(BATCH_SIZE);

    console.log(`Found ${orders.length} pending orders to check.`);

    const summary = {
      paid: 0,
      expired: 0,
      open: 0,
      processing: 0,
      needsReview: 0,
      failed: 0,
    };

    for (const order of orders) {
      console.log(`\nChecking ${order.orderNumber}`);

      try {
        const result = await recoverCheckoutOrder(order);

        switch (result.data.state) {
          case "paid":
            summary.paid++;
            break;

          case "expired":
            summary.expired++;
            break;

          case "ready":
            summary.open++;
            break;

          case "pending":
            summary.processing++;
            break;
        }

        console.log(`Result: ${result.data.state}`);
      } catch (error) {
        if (
          error instanceof CheckoutRecoveryError &&
          error.code === "CHECKOUT_REQUIRES_REVIEW"
        ) {
          console.warn(`Manual payment review required: ${order.orderNumber}`);
          summary.needsReview++;
          continue;
        }

        console.error(
          `Unable to reconcile ${order.orderNumber}:`,
          error instanceof Error ? error.message : "Unknown error",
        );

        summary.failed++;
      }
    }

    console.log("\nReconciliation summary:");
    console.log(summary);

    if (summary.needsReview > 0 || summary.failed > 0) {
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
