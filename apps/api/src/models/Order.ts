import { Schema, model } from "mongoose";

const orderItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },
    productName: {
      type: String,
      required: true,
      maxlength: 120,
    },
    productSlug: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      required: true,
    },
    size: {
      type: String,
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
    },
    unitPriceCents: {
      type: Number,
      required: true,
      min: 0,
    },
    lineTotalCents: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      default: [],
    },
    currency: {
      type: String,
      enum: ["USD"],
      default: "USD",
      required: true,
    },
    subtotalCents: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingCents: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    taxCents: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalCents: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending_payment", "paid", "cancelled", "expired", "refunded"],
      default: "pending_payment",
      required: true,
    },
    reservationStatus: {
      type: String,
      enum: ["none", "active", "released", "committed"],
      default: "none",
      required: true,
    },
    reservationExpiresAt: {
      type: Date,
      default: null,
    },
    stripeCheckoutSessionId: {
      type: String,
      default: undefined,
    },
    stripePaymentIntentId: {
      type: String,
      default: undefined,
    },
    idempotencyKey: {
      type: String,
      required: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

orderSchema.index({
  userId: 1,
  createdAt: -1,
});

// Repeating a checkout request with the same key
// cannot create a second order.
orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });

// Only one unfinished checkout per customer.
// This prevents competing checkout attempts
// from reserving the same cart more than once.
orderSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "pending_payment",
    },
  },
);

orderSchema.index(
  { stripeCheckoutSessionId: 1 },
  { unique: true, sparse: true },
);

export const Order = model("Order", orderSchema);
