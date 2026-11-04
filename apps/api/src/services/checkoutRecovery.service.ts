import { Types } from "mongoose";
import type Stripe from "stripe";

import { Order } from "../models/Order.js";
import { User } from "../models/User.js";

import {
  createStripeSession,
  expireStripeSession,
  retrieveStripeSession,
} from "./stripe.service.js";

import { settleStripeSession } from "./orderSettlement.service.js";

const MAX_RECOVERY_AGE_MS = 4 * 60 * 1000;
const MIN_CREATE_TIME_MS = 31 * 60 * 1000;

type SavedOrder = InstanceType<typeof Order>;

export class CheckoutRecoveryError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "CheckoutRecoveryError";
  }
}

export type CheckoutRecoveryState = "ready" | "paid" | "expired" | "pending";

export interface CheckoutRecoveryResult {
  data: {
    orderId: string;
    orderNumber: string;
    checkoutUrl: string | null;
    expiresAt: string;
    state: CheckoutRecoveryState;
  };
}

function reviewRequired(): never {
  throw new CheckoutRecoveryError(
    409,
    "CHECKOUT_REQUIRES_REVIEW",
    "The checkout needs payment reconciliation before a new attempt can be started.",
  );
}

function validateStripeSession(
  order: SavedOrder,
  checkout: Stripe.Checkout.Session,
) {
  const orderId = String(order._id);

  if (
    checkout.livemode ||
    checkout.mode !== "payment" ||
    checkout.client_reference_id !== orderId ||
    checkout.metadata?.orderId !== orderId ||
    checkout.metadata?.orderNumber !== order.orderNumber ||
    checkout.currency?.toLowerCase() !== "usd" ||
    checkout.amount_total !== order.totalCents
  ) {
    reviewRequired();
  }

  if (
    order.stripeCheckoutSessionId &&
    order.stripeCheckoutSessionId !== checkout.id
  ) {
    reviewRequired();
  }
}

function validStripeUrl(value: string | null) {
  if (!value) return false;

  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname === "checkout.stripe.com";
  } catch {
    return false;
  }
}

function result(
  order: SavedOrder,
  state: CheckoutRecoveryState,
  url: string | null,
  expiration: Date,
): CheckoutRecoveryResult {
  return {
    data: {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      checkoutUrl: url,
      expiresAt: expiration.toISOString(),
      state,
    },
  };
}

async function reconcileSavedSession(
  order: SavedOrder,
  initial: Stripe.Checkout.Session,
): Promise<CheckoutRecoveryResult> {
  let checkout = initial;

  validateStripeSession(order, checkout);

  const expiresAt = new Date(checkout.expires_at * 1000);

  if (!Number.isFinite(expiresAt.getTime())) {
    reviewRequired();
  }

  // An open session may have passed its deadline.
  // Never release inventory based on the clock alone.
  if (checkout.status === "open" && checkout.expires_at * 1000 <= Date.now()) {
    try {
      checkout = await expireStripeSession(checkout.id);
    } catch {
      // Another Stripe operation may have completed
      // or expired the session concurrently.
      checkout = await retrieveStripeSession(checkout.id);
    }

    validateStripeSession(order, checkout);
  }

  if (checkout.payment_status === "paid" || checkout.status === "expired") {
    const outcome = await settleStripeSession(checkout, "reconciliation");

    // Another webhook might have settled the order.
    // Read the authoritative database status.
    const latest = await Order.findById(order._id);

    if (!latest) {
      reviewRequired();
    }

    if (latest.status === "paid") {
      return result(latest, "paid", null, expiresAt);
    }

    if (latest.status === "expired") {
      return result(latest, "expired", null, expiresAt);
    }

    if (outcome === "pending" || latest.status === "pending_payment") {
      reviewRequired();
    }

    reviewRequired();
  }

  if (
    checkout.status === "open" &&
    checkout.expires_at * 1000 > Date.now() &&
    validStripeUrl(checkout.url)
  ) {
    return result(order, "ready", checkout.url, expiresAt);
  }

  // A completed but unpaid session can represent
  // payment processing. It is not an expired order.
  return result(order, "pending", null, expiresAt);
}

export async function recoverCheckoutOrder(
  order: SavedOrder,
): Promise<CheckoutRecoveryResult> {
  if (
    order.status !== "pending_payment" ||
    order.reservationStatus !== "active"
  ) {
    reviewRequired();
  }

  if (order.stripeCheckoutSessionId) {
    // A saved ID is authoritative. Never create
    // a second session for this order.
    const checkout = await retrieveStripeSession(order.stripeCheckoutSessionId);

    return reconcileSavedSession(order, checkout);
  }

  const now = Date.now();
  const createdAt = order.createdAt?.getTime();
  const expiresAt = order.reservationExpiresAt?.getTime();

  // Stripe may prune API v1 idempotency keys
  // after at least 24 hours.
  //
  // Retry missing-ID sessions only in a short,
  // deliberately conservative window, using
  // the identical original expiration time.
  if (
    !createdAt ||
    !expiresAt ||
    now - createdAt > MAX_RECOVERY_AGE_MS ||
    expiresAt - now < MIN_CREATE_TIME_MS
  ) {
    reviewRequired();
  }

  const customer = await User.findOne({
    _id: order.userId,
    active: true,
  })
    .select("email")
    .lean();

  if (!customer) {
    reviewRequired();
  }

  let hosted;

  try {
    // Same order ID -> same Stripe idempotency key.
    // Never regenerate the order or its line items.
    hosted = await createStripeSession({
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      customerEmail: customer.email,
      expiresAt: new Date(expiresAt),

      items: order.items.map((item) => ({
        name: item.productName,
        description: [item.color, item.size, item.sku]
          .filter(Boolean)
          .join(" · "),
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
      })),
    });
  } catch {
    throw new CheckoutRecoveryError(
      502,
      "STRIPE_SESSION_UNAVAILABLE",
      "Stripe Checkout could not be recovered. Retry the same checkout shortly.",
    );
  }

  if (!validStripeUrl(hosted.checkoutUrl)) {
    reviewRequired();
  }

  // A webhook may have settled the order while
  // Stripe was processing the creation request.
  // Never overwrite a terminal order.
  await Order.updateOne(
    {
      _id: order._id,
      status: "pending_payment",
      reservationStatus: "active",
      $or: [
        {
          stripeCheckoutSessionId: {
            $exists: false,
          },
        },
        {
          stripeCheckoutSessionId: null,
        },
        {
          stripeCheckoutSessionId: hosted.sessionId,
        },
      ],
    },
    {
      $set: {
        stripeCheckoutSessionId: hosted.sessionId,
        reservationExpiresAt: hosted.expiresAt,
      },
    },
  );

  const latest = await Order.findById(order._id);

  if (!latest) {
    reviewRequired();
  }

  if (latest.status === "paid") {
    return result(latest, "paid", null, hosted.expiresAt);
  }

  if (
    latest.status !== "pending_payment" ||
    latest.stripeCheckoutSessionId !== hosted.sessionId
  ) {
    reviewRequired();
  }

  return result(latest, "ready", hosted.checkoutUrl, hosted.expiresAt);
}

export async function getActiveCheckout(userId: string) {
  if (!Types.ObjectId.isValid(userId)) {
    throw new CheckoutRecoveryError(
      401,
      "UNAUTHENTICATED",
      "Invalid customer session.",
    );
  }

  const order = await Order.findOne({
    userId: new Types.ObjectId(userId),
    status: "pending_payment",
    reservationStatus: "active",
  }).sort({ createdAt: -1 });

  if (!order) {
    return { data: null };
  }

  return {
    data: {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      expiresAt: order.reservationExpiresAt?.toISOString() ?? null,
    },
  };
}

export async function resumeActiveCheckout(
  userId: string,
): Promise<CheckoutRecoveryResult> {
  if (!Types.ObjectId.isValid(userId)) {
    throw new CheckoutRecoveryError(
      401,
      "UNAUTHENTICATED",
      "Invalid customer session.",
    );
  }

  const order = await Order.findOne({
    userId: new Types.ObjectId(userId),
    status: "pending_payment",
    reservationStatus: "active",
  }).sort({ createdAt: -1 });

  if (!order) {
    throw new CheckoutRecoveryError(
      404,
      "NO_ACTIVE_CHECKOUT",
      "No active checkout was found.",
    );
  }

  return recoverCheckoutOrder(order);
}
