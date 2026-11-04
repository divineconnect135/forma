import { randomBytes } from "node:crypto";

import mongoose, { Types } from "mongoose";

import { Cart } from "../models/Cart.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
import { User } from "../models/User.js";

import { getCart } from "./cart.service.js";
import { createStripeSession } from "./stripe.service.js";

const RESERVATION_MINUTES = 35;

export class CheckoutError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

// Read-only checkout summary from Phase 5, Step 1.
export async function getCheckoutPreview(userId: string) {
  const result = await getCart(userId);
  const cart = result.data;

  if (cart.items.length === 0) {
    throw new CheckoutError(400, "EMPTY_CART", "Add products before checkout.");
  }

  if (cart.hasUnavailableItems) {
    throw new CheckoutError(
      409,
      "CART_ITEMS_UNAVAILABLE",
      "Some cart items are unavailable or exceed stock.",
    );
  }

  if (cart.subtotalCents <= 0 || !Number.isSafeInteger(cart.subtotalCents)) {
    throw new CheckoutError(
      400,
      "INVALID_SUBTOTAL",
      "Unable to calculate a valid subtotal.",
    );
  }

  return {
    data: {
      items: cart.items,
      itemCount: cart.itemCount,
      subtotalCents: cart.subtotalCents,
      currency: "USD" as const,
      shippingCents: null,
      taxCents: null,
      totalCents: null,
      requiresPayment: true,
    },
  };
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

export async function startCheckout(userId: string, idempotencyKey: string) {
  if (!Types.ObjectId.isValid(userId)) {
    throw new CheckoutError(
      401,
      "UNAUTHENTICATED",
      "Invalid customer session.",
    );
  }

  const customerId = new Types.ObjectId(userId);

  const customer = await User.findOne({
    _id: customerId,
    active: true,
  })
    .select("email")
    .lean();

  if (!customer) {
    throw new CheckoutError(
      401,
      "UNAUTHENTICATED",
      "Customer account is unavailable.",
    );
  }

  // Ensure unique order indexes exist before
  // attempting concurrent checkout creation.
  await Order.init();

  let order: InstanceType<typeof Order>;

  try {
    order = await mongoose.connection.transaction(async (session) => {
      // A retry with the same key reuses its order.
      const previous = await Order.findOne({
        userId: customerId,
        idempotencyKey,
      }).session(session);

      if (previous) {
        if (previous.status !== "pending_payment") {
          throw new CheckoutError(
            409,
            "CHECKOUT_ALREADY_USED",
            "This checkout attempt has already ended.",
          );
        }

        return previous;
      }

      // A different key must not create another
      // active checkout for this customer.
      const active = await Order.findOne({
        userId: customerId,
        status: "pending_payment",
      }).session(session);

      if (active) {
        throw new CheckoutError(
          409,
          "ACTIVE_CHECKOUT_EXISTS",
          "You already have an unfinished checkout.",
        );
      }

      // The cart is read inside the transaction,
      // not trusted from the browser.
      const cart = await Cart.findOne({
        userId: customerId,
      }).session(session);

      if (!cart || cart.items.length === 0) {
        throw new CheckoutError(400, "EMPTY_CART", "Your cart is empty.");
      }

      const orderItems: {
        productId: Types.ObjectId;
        variantId: Types.ObjectId;
        productName: string;
        productSlug: string;
        sku: string;
        color: string;
        size: string | null;
        quantity: number;
        unitPriceCents: number;
        lineTotalCents: number;
      }[] = [];

      let subtotalCents = 0;

      for (const item of cart.items) {
        const quantity = item.quantity;

        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
          throw new CheckoutError(
            400,
            "INVALID_QUANTITY",
            "Invalid cart quantity.",
          );
        }

        // This conditional update is atomic.
        // The variant is reserved only if enough
        // unreserved inventory still exists.
        const variant = await ProductVariant.findOneAndUpdate(
          {
            _id: item.variantId,
            active: true,
            $expr: {
              $gte: [
                {
                  $subtract: ["$stockOnHand", "$stockReserved"],
                },
                quantity,
              ],
            },
          },
          {
            $inc: {
              stockReserved: quantity,
            },
          },
          {
            new: true,
            session,
          },
        );

        if (!variant) {
          throw new CheckoutError(
            409,
            "INSUFFICIENT_STOCK",
            "A selected variant is unavailable or out of stock.",
          );
        }

        const product = await Product.findOne({
          _id: variant.productId,
          status: "active",
        }).session(session);

        if (!product) {
          throw new CheckoutError(
            409,
            "PRODUCT_UNAVAILABLE",
            "A product in your cart is unavailable.",
          );
        }

        const price = product.priceCents;

        if (!Number.isSafeInteger(price) || price <= 0) {
          throw new CheckoutError(
            400,
            "INVALID_PRODUCT_PRICE",
            "A product has an invalid price.",
          );
        }

        const lineTotal = price * quantity;

        if (!Number.isSafeInteger(lineTotal)) {
          throw new CheckoutError(
            400,
            "INVALID_ORDER_TOTAL",
            "Unable to calculate the order total.",
          );
        }

        subtotalCents += lineTotal;

        if (!Number.isSafeInteger(subtotalCents)) {
          throw new CheckoutError(
            400,
            "INVALID_ORDER_TOTAL",
            "The order total is too large.",
          );
        }

        orderItems.push({
          productId: product._id,
          variantId: variant._id,
          productName: product.name,
          productSlug: product.slug,
          sku: variant.sku,
          color: variant.color,
          size: variant.size ?? null,
          quantity,
          unitPriceCents: price,
          lineTotalCents: lineTotal,
        });
      }

      const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

      const orderNumber = "FM-" + randomBytes(8).toString("hex").toUpperCase();

      // The order and all inventory reservations
      // commit together, or none commit.
      const created = await Order.create(
        [
          {
            orderNumber,
            userId: customerId,
            items: orderItems,
            currency: "USD",
            subtotalCents,

            // Test-mode simplified checkout only.
            shippingCents: 0,
            taxCents: 0,
            totalCents: subtotalCents,

            status: "pending_payment",
            reservationStatus: "active",
            reservationExpiresAt: expiresAt,
            idempotencyKey,
          },
        ],
        { session },
      );

      return created[0]!;
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const existing = await Order.findOne({
        userId: customerId,
        status: "pending_payment",
      });

      if (existing && existing.idempotencyKey === idempotencyKey) {
        order = existing;
      } else {
        throw new CheckoutError(
          409,
          "ACTIVE_CHECKOUT_EXISTS",
          "Another checkout is already in progress.",
        );
      }
    } else {
      throw error;
    }
  }

  const expiresAt = order.reservationExpiresAt;

  if (!expiresAt || expiresAt <= new Date()) {
    throw new CheckoutError(
      409,
      "CHECKOUT_EXPIRED",
      "This checkout has expired. Reservation reconciliation is required.",
    );
  }

  // External Stripe calls must happen AFTER the
  // MongoDB transaction has committed.
  // Stripe never receives the client's cart prices.
  let hostedSession;

  try {
    hostedSession = await createStripeSession({
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      customerEmail: customer.email,
      expiresAt,
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
    // An API/network failure may have happened after
    // Stripe created the session. Do not blindly
    // release stock, because payment might still be
    // possible. Retry with the same order ID.
    throw new CheckoutError(
      502,
      "STRIPE_SESSION_UNAVAILABLE",
      "Unable to open Stripe Checkout. Retry this checkout attempt.",
    );
  }

  if (
    order.stripeCheckoutSessionId &&
    order.stripeCheckoutSessionId !== hostedSession.sessionId
  ) {
    throw new CheckoutError(
      409,
      "CHECKOUT_SESSION_CONFLICT",
      "A different Stripe session is already linked to this order.",
    );
  }

  // Store the Stripe session ID for webhook
  // reconciliation in Phase 5, Step 3.
  try {
    await Order.updateOne(
      {
        _id: order._id,
        status: "pending_payment",
      },
      {
        $set: {
          stripeCheckoutSessionId: hostedSession.sessionId,
          reservationExpiresAt: hostedSession.expiresAt,
        },
      },
    );
  } catch {
    throw new CheckoutError(
      502,
      "CHECKOUT_SAVE_FAILED",
      "Unable to save the checkout session. Retry the same attempt.",
    );
  }

  return {
    data: {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      checkoutUrl: hostedSession.checkoutUrl,
      expiresAt: hostedSession.expiresAt.toISOString(),
    },
  };
}
