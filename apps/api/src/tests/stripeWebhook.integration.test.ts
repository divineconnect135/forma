import { createHmac } from "node:crypto";

import mongoose from "mongoose";
import request from "supertest";
import type Stripe from "stripe";

import { MongoMemoryReplSet } from "mongodb-memory-server";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { app } from "../app.js";

import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";

import { retrieveStripeSession } from "../services/stripe.service.js";

// Keep real signature verification but mock
// network-based Stripe Session retrieval.
vi.mock("../services/stripe.service.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/stripe.service.js")>();

  return {
    ...actual,
    retrieveStripeSession: vi.fn(),
  };
});

const WEBHOOK_SECRET = "whsec_forma_integration_test_secret";

let mongoServer: MongoMemoryReplSet;

let orderId: string;
let sessionId: string;
let variantId: string;
let orderNumber: string;

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_forma_webhook_tests";

  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;

  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });

  await mongoose.connect(mongoServer.getUri("forma_webhook_test"));

  await Product.init();
  await ProductVariant.init();
  await Order.init();
}, 120_000);

beforeEach(async () => {
  vi.mocked(retrieveStripeSession).mockReset();

  await Order.deleteMany({});
  await ProductVariant.deleteMany({});
  await Product.deleteMany({});

  const product = await Product.create({
    name: "Orbit Desk Lamp",
    slug: "orbit-desk-lamp",
    description: "Adjustable desk lamp",
    category: "lighting",
    priceCents: 12900,
    currency: "USD",
    status: "active",
    images: [],
    featured: true,
  });

  const variant = await ProductVariant.create({
    productId: product._id,
    sku: "WEBHOOK-ORBIT-BLACK",
    color: "Black",
    size: null,
    stockOnHand: 5,
    stockReserved: 2,
    active: true,
  });

  variantId = String(variant._id);

  const order = await Order.create({
    orderNumber: "FM-WEBHOOK-TEST",
    userId: new mongoose.Types.ObjectId(),

    items: [
      {
        productId: product._id,
        variantId: variant._id,
        productName: product.name,
        productSlug: product.slug,
        sku: variant.sku,
        color: variant.color,
        size: null,
        quantity: 2,
        unitPriceCents: 12900,
        lineTotalCents: 25800,
      },
    ],

    currency: "USD",
    subtotalCents: 25800,
    shippingCents: 0,
    taxCents: 0,
    totalCents: 25800,

    status: "pending_payment",
    reservationStatus: "active",

    reservationExpiresAt: new Date(Date.now() + 35 * 60 * 1000),

    idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
  });

  orderId = String(order._id);
  orderNumber = order.orderNumber;

  sessionId = `cs_test_${orderId}`;

  await Order.updateOne(
    { _id: order._id },
    {
      $set: {
        stripeCheckoutSessionId: sessionId,
      },
    },
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

function makeStripeSession(
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
  return {
    id: sessionId,
    object: "checkout.session",

    livemode: false,
    mode: "payment",

    client_reference_id: orderId,

    metadata: {
      orderId,
      orderNumber,
    },

    currency: "usd",
    amount_total: 25800,

    payment_status: "paid",
    status: "complete",

    payment_intent: "pi_test_forma_payment",

    expires_at: Math.floor(Date.now() / 1000) + 2100,

    ...overrides,
  } as Stripe.Checkout.Session;
}

function sendSignedEvent(eventType: string, stripeSessionId = sessionId) {
  const payload = JSON.stringify({
    id: "evt_test_forma_webhook",
    object: "event",
    type: eventType,
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: stripeSessionId,
        object: "checkout.session",
      },
    },
  });

  const timestamp = Math.floor(Date.now() / 1000);

  const signature = createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return request(app)
    .post("/api/webhooks/stripe")
    .set("Content-Type", "application/json")
    .set("Stripe-Signature", `t=${timestamp},v1=${signature}`)
    .send(payload);
}

async function getStock() {
  return ProductVariant.findById(variantId).lean();
}

describe("Stripe webhook processing", () => {
  it("rejects missing or invalid signatures", async () => {
    const response = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .send(
        JSON.stringify({
          type: "checkout.session.completed",
        }),
      );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_WEBHOOK");

    const stock = await getStock();

    expect(stock?.stockOnHand).toBe(5);
    expect(stock?.stockReserved).toBe(2);
  });

  it("marks a verified payment as paid", async () => {
    vi.mocked(retrieveStripeSession).mockResolvedValue(makeStripeSession());

    const response = await sendSignedEvent("checkout.session.completed");

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("paid");

    const order = await Order.findById(orderId);

    expect(order?.status).toBe("paid");
    expect(order?.reservationStatus).toBe("committed");

    expect(order?.paidAt).not.toBeNull();

    expect(order?.stripePaymentIntentId).toBe("pi_test_forma_payment");

    const stock = await getStock();

    expect(stock?.stockOnHand).toBe(3);
    expect(stock?.stockReserved).toBe(0);
  });

  it("does not deduct stock twice", async () => {
    vi.mocked(retrieveStripeSession).mockResolvedValue(makeStripeSession());

    const first = await sendSignedEvent("checkout.session.completed");

    expect(first.status).toBe(200);

    const second = await sendSignedEvent("checkout.session.completed");

    expect(second.status).toBe(200);

    expect(second.body.result).toBe("already-finalized");

    const stock = await getStock();

    expect(stock?.stockOnHand).toBe(3);
    expect(stock?.stockReserved).toBe(0);
  });

  it("releases stock when Stripe confirms expiration", async () => {
    vi.mocked(retrieveStripeSession).mockResolvedValue(
      makeStripeSession({
        status: "expired",
        payment_status: "unpaid",
      }),
    );

    const response = await sendSignedEvent("checkout.session.expired");

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("expired");

    const order = await Order.findById(orderId);

    expect(order?.status).toBe("expired");
    expect(order?.reservationStatus).toBe("released");

    const stock = await getStock();

    expect(stock?.stockOnHand).toBe(5);
    expect(stock?.stockReserved).toBe(0);
  });

  it("releases stock after confirmed asynchronous failure", async () => {
    vi.mocked(retrieveStripeSession).mockResolvedValue(
      makeStripeSession({
        status: "complete",
        payment_status: "unpaid",
      }),
    );

    const response = await sendSignedEvent(
      "checkout.session.async_payment_failed",
    );

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("cancelled");

    const order = await Order.findById(orderId);

    expect(order?.status).toBe("cancelled");

    const stock = await getStock();

    expect(stock?.stockOnHand).toBe(5);
    expect(stock?.stockReserved).toBe(0);
  });

  it("does not mark an unpaid checkout as paid", async () => {
    vi.mocked(retrieveStripeSession).mockResolvedValue(
      makeStripeSession({
        status: "complete",
        payment_status: "unpaid",
      }),
    );

    const response = await sendSignedEvent("checkout.session.completed");

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("pending");

    const order = await Order.findById(orderId);

    expect(order?.status).toBe("pending_payment");

    const stock = await getStock();

    expect(stock?.stockOnHand).toBe(5);
    expect(stock?.stockReserved).toBe(2);
  });

  it("rejects an amount mismatch without changing inventory", async () => {
    vi.mocked(retrieveStripeSession).mockResolvedValue(
      makeStripeSession({
        amount_total: 100,
      }),
    );

    const response = await sendSignedEvent("checkout.session.completed");

    expect(response.status).toBe(500);

    const order = await Order.findById(orderId);

    expect(order?.status).toBe("pending_payment");

    const stock = await getStock();

    expect(stock?.stockOnHand).toBe(5);
    expect(stock?.stockReserved).toBe(2);
  });

  it("does not let a stale event override a paid order", async () => {
    vi.mocked(retrieveStripeSession).mockResolvedValue(makeStripeSession());

    const paidResponse = await sendSignedEvent("checkout.session.completed");

    expect(paidResponse.status).toBe(200);

    const expiredResponse = await sendSignedEvent("checkout.session.expired");

    expect(expiredResponse.status).toBe(200);

    const order = await Order.findById(orderId);

    expect(order?.status).toBe("paid");

    const stock = await getStock();

    expect(stock?.stockOnHand).toBe(3);
    expect(stock?.stockReserved).toBe(0);
  });

  it("ignores unrelated Stripe event types", async () => {
    const response = await sendSignedEvent("payment_intent.created");

    expect(response.status).toBe(200);
    expect(response.body.result).toBe("ignored");

    expect(retrieveStripeSession).not.toHaveBeenCalled();
  });
});
