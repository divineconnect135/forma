import mongoose, { Types } from "mongoose";
import type Stripe from "stripe";

import { Cart } from "../models/Cart.js";
import { Order } from "../models/Order.js";
import { ProductVariant } from "../models/ProductVariant.js";

import { retrieveStripeSession } from "./stripe.service.js";

export type SettlementReason =
  "webhook-completed" | "webhook-expired" | "webhook-failed" | "reconciliation";

export type SettlementResult =
  | "paid"
  | "expired"
  | "cancelled"
  | "pending"
  | "already-finalized"
  | "ignored";

function getOrderId(checkout: Stripe.Checkout.Session): string | null {
  const orderId = checkout.metadata?.orderId;

  if (typeof orderId !== "string" || !/^[a-fA-F0-9]{24}$/.test(orderId)) {
    return null;
  }

  return orderId;
}

function getPaymentIntentId(
  checkout: Stripe.Checkout.Session,
): string | undefined {
  return typeof checkout.payment_intent === "string"
    ? checkout.payment_intent
    : checkout.payment_intent?.id;
}

export async function settleStripeSession(
  checkout: Stripe.Checkout.Session,
  reason: SettlementReason,
): Promise<SettlementResult> {
  const orderId = getOrderId(checkout);

  if (!orderId) {
    return "ignored";
  }

  if (
    checkout.livemode ||
    checkout.mode !== "payment" ||
    checkout.client_reference_id !== orderId
  ) {
    throw new Error("Stripe checkout identity validation failed");
  }

  return mongoose.connection.transaction(async (session) => {
    const order = await Order.findById(new Types.ObjectId(orderId)).session(
      session,
    );

    if (!order) {
      throw new Error("Stripe payment references a missing order");
    }

    if (checkout.metadata?.orderNumber !== order.orderNumber) {
      throw new Error("Stripe order number mismatch");
    }

    if (
      order.stripeCheckoutSessionId &&
      order.stripeCheckoutSessionId !== checkout.id
    ) {
      throw new Error("Stripe session does not match order");
    }

    if (
      checkout.currency?.toLowerCase() !== "usd" ||
      checkout.amount_total !== order.totalCents
    ) {
      throw new Error("Stripe amount or currency mismatch");
    }

    // A finalized order must never alter
    // inventory or the cart again.
    if (
      order.status !== "pending_payment" ||
      order.reservationStatus !== "active"
    ) {
      return "already-finalized" as const;
    }

    const paymentSucceeded = checkout.payment_status === "paid";

    const checkoutExpired = checkout.status === "expired";

    const paymentFailed =
      reason === "webhook-failed" && checkout.payment_status !== "paid";

    if (!paymentSucceeded && !checkoutExpired && !paymentFailed) {
      return "pending" as const;
    }

    const outcome: "paid" | "expired" | "cancelled" = paymentSucceeded
      ? "paid"
      : checkoutExpired
        ? "expired"
        : "cancelled";

    // Settle every reserved product within
    // the same MongoDB transaction.
    for (const item of order.items) {
      const quantity = item.quantity;

      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        throw new Error("Invalid reserved item quantity");
      }

      const stockFilter = {
        _id: item.variantId,
        stockReserved: { $gte: quantity },

        ...(outcome === "paid"
          ? {
              stockOnHand: { $gte: quantity },
            }
          : {}),
      };

      const stockChanges =
        outcome === "paid"
          ? {
              stockReserved: -quantity,
              stockOnHand: -quantity,
            }
          : {
              stockReserved: -quantity,
            };

      const updated = await ProductVariant.updateOne(
        stockFilter,
        {
          $inc: stockChanges,
        },
        { session },
      );

      if (updated.modifiedCount !== 1) {
        throw new Error("Unable to finalize reserved inventory");
      }
    }

    order.stripeCheckoutSessionId = checkout.id;

    if (outcome === "paid") {
      order.status = "paid";
      order.reservationStatus = "committed";
      order.paidAt = new Date();

      const paymentIntentId = getPaymentIntentId(checkout);

      if (paymentIntentId) {
        order.stripePaymentIntentId = paymentIntentId;
      }

      // Remove only matching purchased items.
      // If a line's quantity changed after
      // checkout started, keep it unchanged.
      for (const item of order.items) {
        await Cart.updateOne(
          {
            userId: order.userId,
          },
          {
            $pull: {
              items: {
                variantId: item.variantId,
                quantity: item.quantity,
              },
            },
          },
          { session },
        );
      }
    } else {
      order.status = outcome === "expired" ? "expired" : "cancelled";

      order.reservationStatus = "released";

      // Failed or expired checkout:
      // keep the customer's cart intact.
    }

    await order.save({ session });

    return outcome;
  });
}

export async function handleStripeCheckoutEvent(
  event: Stripe.Event,
): Promise<SettlementResult> {
  const supportedTypes = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
  ];

  if (!supportedTypes.includes(event.type)) {
    return "ignored";
  }

  const object = event.data.object as Stripe.Checkout.Session;

  if (object.object !== "checkout.session" || !object.id) {
    throw new Error("Invalid Stripe Checkout event object");
  }

  // Always read the current session from Stripe,
  // not just its potentially stale webhook snapshot.
  const latest = await retrieveStripeSession(object.id);

  const reason: SettlementReason =
    event.type === "checkout.session.expired"
      ? "webhook-expired"
      : event.type === "checkout.session.async_payment_failed"
        ? "webhook-failed"
        : "webhook-completed";

  return settleStripeSession(latest, reason);
}
