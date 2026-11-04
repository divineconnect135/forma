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

import { User } from "../models/User.js";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
import { Order } from "../models/Order.js";
import { Cart } from "../models/Cart.js";

import {
  createStripeSession,
  retrieveStripeSession,
  expireStripeSession,
} from "../services/stripe.service.js";

// Mock Stripe network requests.
// No real payments are created by these tests.
vi.mock("../services/stripe.service.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/stripe.service.js")>();

  return {
    ...actual,
    createStripeSession: vi.fn(),
    retrieveStripeSession: vi.fn(),
    expireStripeSession: vi.fn(),
  };
});

let mongoServer: MongoMemoryReplSet;

const password = "SecureTestPassword123!";

const TEST_KEY = "123e4567-e89b-42d3-a456-426614174000";

// ---------------------------------------------
// TEST DATABASE SETUP
// ---------------------------------------------

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });

  await mongoose.connect(mongoServer.getUri("forma_recovery_test"));

  await User.init();
  await Product.init();
  await ProductVariant.init();
  await Order.init();
  await Cart.init();
}, 120_000);

beforeEach(async () => {
  vi.mocked(createStripeSession).mockReset();
  vi.mocked(retrieveStripeSession).mockReset();
  vi.mocked(expireStripeSession).mockReset();

  await Order.deleteMany({});
  await Cart.deleteMany({});
  await ProductVariant.deleteMany({});
  await Product.deleteMany({});
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

// ---------------------------------------------
// TEST HELPERS
// ---------------------------------------------

async function registerCustomer() {
  const agent = request.agent(app);

  const csrf = await agent.get("/api/auth/csrf");

  expect(csrf.status).toBe(200);

  const response = await agent
    .post("/api/auth/register")
    .set("X-CSRF-Token", csrf.body.csrfToken)
    .send({
      name: "Recovery Test Customer",
      email: "recovery@example.com",
      password,
    });

  expect(response.status).toBe(201);

  const nextCsrf = await agent.get("/api/auth/csrf");

  expect(nextCsrf.status).toBe(200);

  return {
    agent,
    userId: response.body.data.user.id as string,
    csrfToken: nextCsrf.body.csrfToken as string,
  };
}

async function createPendingOrder(userId: string, saveSessionId = true) {
  const product = await Product.create({
    name: "Orbit Desk Lamp",
    slug: "orbit-desk-lamp",
    description: "Adjustable modern desk lamp",
    category: "lighting",
    priceCents: 12900,
    currency: "USD",
    status: "active",
    featured: true,
    images: [],
  });

  const variant = await ProductVariant.create({
    productId: product._id,
    sku: "RECOVERY-ORBIT-BLACK",
    color: "Black",
    size: null,
    stockOnHand: 5,
    stockReserved: 2,
    active: true,
  });

  const order = new Order({
    orderNumber: "FM-RECOVERY-TEST",

    userId: new mongoose.Types.ObjectId(userId),

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

    idempotencyKey: TEST_KEY,
  });

  await order.save();

  const orderId = String(order._id);
  const sessionId = `cs_test_${orderId}`;

  if (saveSessionId) {
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          stripeCheckoutSessionId: sessionId,
        },
      },
    );
  }

  return {
    orderId,
    sessionId,
    orderNumber: order.orderNumber,
    variantId: String(variant._id),
  };
}

// Create a Stripe Session fixture.
//
// This deliberately contains only the properties
// needed by the checkout recovery service.
function makeStripeSession(
  saved: {
    orderId: string;
    sessionId: string;
    orderNumber: string;
  },
  status: "open" | "complete" | "expired",
  paymentStatus: "paid" | "unpaid" = "unpaid",
): Stripe.Checkout.Session {
  const session = {
    id: saved.sessionId,
    object: "checkout.session",

    livemode: false,
    mode: "payment",

    client_reference_id: saved.orderId,

    metadata: {
      orderId: saved.orderId,
      orderNumber: saved.orderNumber,
    },

    currency: "usd",
    amount_total: 25800,

    status,
    payment_status: paymentStatus,

    expires_at: Math.floor(Date.now() / 1000) + 2100,

    url:
      status === "open"
        ? "https://checkout.stripe.com/c/pay/recovery-test"
        : null,

    payment_intent: paymentStatus === "paid" ? "pi_test_recovery_paid" : null,
  };

  return session as unknown as Stripe.Checkout.Session;
}

// ---------------------------------------------
// CHECKOUT RECOVERY TESTS
// ---------------------------------------------

describe("Checkout recovery", () => {
  it("requires authentication for active checkout lookup", async () => {
    const response = await request(app).get("/api/checkout/active");

    expect(response.status).toBe(401);

    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns the existing pending order", async () => {
    const customer = await registerCustomer();

    const saved = await createPendingOrder(customer.userId);

    const response = await customer.agent.get("/api/checkout/active");

    expect(response.status).toBe(200);

    expect(response.body.data).toMatchObject({
      orderId: saved.orderId,
      orderNumber: saved.orderNumber,
    });
  });

  it("requires CSRF for resuming a checkout", async () => {
    const customer = await registerCustomer();

    await createPendingOrder(customer.userId);

    const response = await customer.agent.post("/api/checkout/resume").send({});

    expect(response.status).toBe(403);
  });

  it("resumes a saved session without creating another one", async () => {
    const customer = await registerCustomer();

    const saved = await createPendingOrder(customer.userId);

    vi.mocked(retrieveStripeSession).mockResolvedValue(
      makeStripeSession(saved, "open"),
    );

    const response = await customer.agent
      .post("/api/checkout/resume")
      .set("X-CSRF-Token", customer.csrfToken)
      .send({});

    expect(response.status).toBe(200);

    expect(response.body.data.state).toBe("ready");

    expect(response.body.data.checkoutUrl).toContain("checkout.stripe.com");

    expect(createStripeSession).not.toHaveBeenCalled();

    expect(await Order.countDocuments()).toBe(1);

    const variant = await ProductVariant.findById(saved.variantId);

    expect(variant?.stockReserved).toBe(2);
  });

  it("recovers a recent missing session ID", async () => {
    const customer = await registerCustomer();

    const saved = await createPendingOrder(customer.userId, false);

    vi.mocked(createStripeSession).mockResolvedValue({
      sessionId: saved.sessionId,
      checkoutUrl: "https://checkout.stripe.com/c/pay/recovery-test",
      expiresAt: new Date(Date.now() + 35 * 60 * 1000),
    });

    const response = await customer.agent
      .post("/api/checkout/resume")
      .set("X-CSRF-Token", customer.csrfToken)
      .send({});

    expect(response.status).toBe(200);

    expect(response.body.data.state).toBe("ready");

    expect(createStripeSession).toHaveBeenCalledTimes(1);

    const order = await Order.findById(saved.orderId);

    expect(order?.stripeCheckoutSessionId).toBe(saved.sessionId);

    const variant = await ProductVariant.findById(saved.variantId);

    expect(variant?.stockReserved).toBe(2);
  });

  // FIXED TEST:
  //
  // Mongoose createdAt is immutable by default.
  // Use the native MongoDB collection API to
  // set the timestamp in this test fixture.
  //
  // Verify that the update actually succeeded
  // before calling the checkout API.
  it("refuses unsafe recovery of an old missing session", async () => {
    const customer = await registerCustomer();

    const saved = await createPendingOrder(customer.userId, false);

    const oldCreatedAt = new Date(Date.now() - 10 * 60 * 1000);

    const updateResult = await Order.collection.updateOne(
      {
        _id: new mongoose.Types.ObjectId(saved.orderId),
      },
      {
        $set: {
          createdAt: oldCreatedAt,
        },
      },
    );

    expect(updateResult.matchedCount).toBe(1);
    expect(updateResult.modifiedCount).toBe(1);

    // Confirm the old timestamp really exists
    // in the database before testing recovery.
    const oldOrder = await Order.findById(saved.orderId);

    expect(oldOrder).not.toBeNull();

    expect(oldOrder?.createdAt.getTime()).toBe(oldCreatedAt.getTime());

    // Recovery must refuse the old uncertain
    // Stripe request without creating a new one.
    const response = await customer.agent
      .post("/api/checkout/resume")
      .set("X-CSRF-Token", customer.csrfToken)
      .send({});

    expect(response.status, JSON.stringify(response.body)).toBe(409);

    expect(response.body.error.code).toBe("CHECKOUT_REQUIRES_REVIEW");

    expect(createStripeSession).not.toHaveBeenCalled();

    // Inventory remains reserved until the
    // payment outcome can be established.
    const variant = await ProductVariant.findById(saved.variantId);

    expect(variant?.stockOnHand).toBe(5);
    expect(variant?.stockReserved).toBe(2);

    const order = await Order.findById(saved.orderId);

    expect(order?.status).toBe("pending_payment");

    expect(order?.reservationStatus).toBe("active");

    expect(order?.stripeCheckoutSessionId).toBeFalsy();
  });

  it("settles a verified paid session", async () => {
    const customer = await registerCustomer();

    const saved = await createPendingOrder(customer.userId);

    vi.mocked(retrieveStripeSession).mockResolvedValue(
      makeStripeSession(saved, "complete", "paid"),
    );

    const response = await customer.agent
      .post("/api/checkout/resume")
      .set("X-CSRF-Token", customer.csrfToken)
      .send({});

    expect(response.status).toBe(200);

    expect(response.body.data.state).toBe("paid");

    const order = await Order.findById(saved.orderId);

    const variant = await ProductVariant.findById(saved.variantId);

    expect(order?.status).toBe("paid");

    expect(order?.reservationStatus).toBe("committed");

    expect(variant?.stockOnHand).toBe(3);
    expect(variant?.stockReserved).toBe(0);
  });

  it("releases inventory only after confirmed expiration", async () => {
    const customer = await registerCustomer();

    const saved = await createPendingOrder(customer.userId);

    vi.mocked(retrieveStripeSession).mockResolvedValue(
      makeStripeSession(saved, "expired", "unpaid"),
    );

    const response = await customer.agent
      .post("/api/checkout/resume")
      .set("X-CSRF-Token", customer.csrfToken)
      .send({});

    expect(response.status).toBe(200);

    expect(response.body.data.state).toBe("expired");

    const order = await Order.findById(saved.orderId);

    const variant = await ProductVariant.findById(saved.variantId);

    expect(order?.status).toBe("expired");

    expect(order?.reservationStatus).toBe("released");

    expect(variant?.stockOnHand).toBe(5);
    expect(variant?.stockReserved).toBe(0);
  });

  it("keeps a completed but unpaid checkout pending", async () => {
    const customer = await registerCustomer();

    const saved = await createPendingOrder(customer.userId);

    vi.mocked(retrieveStripeSession).mockResolvedValue(
      makeStripeSession(saved, "complete", "unpaid"),
    );

    const response = await customer.agent
      .post("/api/checkout/resume")
      .set("X-CSRF-Token", customer.csrfToken)
      .send({});

    expect(response.status).toBe(200);

    expect(response.body.data.state).toBe("pending");

    const order = await Order.findById(saved.orderId);

    const variant = await ProductVariant.findById(saved.variantId);

    expect(order?.status).toBe("pending_payment");

    expect(variant?.stockReserved).toBe(2);
  });

  it("rejects a mismatched Stripe payment amount", async () => {
    const customer = await registerCustomer();

    const saved = await createPendingOrder(customer.userId);

    const session = makeStripeSession(saved, "complete", "paid");

    session.amount_total = 100;

    vi.mocked(retrieveStripeSession).mockResolvedValue(session);

    const response = await customer.agent
      .post("/api/checkout/resume")
      .set("X-CSRF-Token", customer.csrfToken)
      .send({});

    expect(response.status).toBe(409);

    expect(response.body.error.code).toBe("CHECKOUT_REQUIRES_REVIEW");

    const order = await Order.findById(saved.orderId);

    const variant = await ProductVariant.findById(saved.variantId);

    expect(order?.status).toBe("pending_payment");

    expect(variant?.stockReserved).toBe(2);
  });
});
