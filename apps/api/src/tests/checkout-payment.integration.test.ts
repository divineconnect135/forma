import mongoose from "mongoose";
import request from "supertest";

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
import { Cart } from "../models/Cart.js";
import { Order } from "../models/Order.js";

import {
  createStripeSession,
  retrieveStripeSession,
} from "../services/stripe.service.js";

// ============================================
// STRIPE TEST GATEWAY
// ============================================

// Retain mocked Stripe Sessions so that
// checkout recovery can retrieve the same
// session on subsequent requests.

const stripeSessions = vi.hoisted(
  () =>
    new Map<
      string,
      {
        orderId: string;
        orderNumber: string;
        amountTotal: number;
        expiresAt: Date;
        checkoutUrl: string;
      }
    >(),
);

// All Stripe network calls are mocked.
// No real payment or Checkout Session is created.

vi.mock("../services/stripe.service.js", () => ({
  createStripeSession: vi.fn(
    async (input: {
      orderId: string;
      orderNumber: string;
      expiresAt: Date;
      items: {
        unitPriceCents: number;
        quantity: number;
      }[];
    }) => {
      const sessionId = `cs_test_${input.orderId}`;

      const checkoutUrl = "https://checkout.stripe.com/c/pay/test-session";

      const amountTotal = input.items.reduce(
        (total, item) => total + item.unitPriceCents * item.quantity,
        0,
      );

      stripeSessions.set(sessionId, {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        amountTotal,
        expiresAt: input.expiresAt,
        checkoutUrl,
      });

      return {
        sessionId,
        checkoutUrl,
        expiresAt: input.expiresAt,
      };
    },
  ),

  retrieveStripeSession: vi.fn(async (sessionId: string) => {
    const saved = stripeSessions.get(sessionId);

    if (!saved) {
      throw new Error(`Mock Stripe Session not found: ${sessionId}`);
    }

    return {
      id: sessionId,
      object: "checkout.session",

      livemode: false,
      mode: "payment",

      client_reference_id: saved.orderId,

      metadata: {
        orderId: saved.orderId,
        orderNumber: saved.orderNumber,
      },

      currency: "usd",
      amount_total: saved.amountTotal,

      status: "open",
      payment_status: "unpaid",

      expires_at: Math.floor(saved.expiresAt.getTime() / 1000),

      url: saved.checkoutUrl,

      payment_intent: null,
    };
  }),

  expireStripeSession: vi.fn(async () => {
    throw new Error("Unexpected Stripe Session expiration in payment tests");
  }),
}));

// ============================================
// TEST CONFIGURATION
// ============================================

let mongoServer: MongoMemoryReplSet;
let variantId: string;

const customer = {
  name: "Payment Test Customer",
  email: "payment-test@example.com",
  password: "SecureTestPassword123!",
};

const FIRST_KEY = "123e4567-e89b-42d3-a456-426614174000";

const SECOND_KEY = "123e4567-e89b-42d3-a456-426614174001";

// ============================================
// DATABASE SETUP
// ============================================

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });

  await mongoose.connect(mongoServer.getUri("forma_payment_test"));

  await User.init();
  await Product.init();
  await ProductVariant.init();
  await Cart.init();
  await Order.init();
}, 120_000);

beforeEach(async () => {
  // Clear mocked Stripe history between tests.
  // mockClear preserves the mock implementation.
  vi.mocked(createStripeSession).mockClear();
  vi.mocked(retrieveStripeSession).mockClear();

  stripeSessions.clear();

  await Order.deleteMany({});
  await Cart.deleteMany({});
  await ProductVariant.deleteMany({});
  await Product.deleteMany({});
  await User.deleteMany({});

  const product = await Product.create({
    name: "Orbit Desk Lamp",
    slug: "orbit-desk-lamp",
    description: "Adjustable desk lamp",
    category: "lighting",
    priceCents: 12900,
    currency: "USD",
    images: [],
    status: "active",
    featured: true,
  });

  const variant = await ProductVariant.create({
    productId: product._id,
    sku: "PAYMENT-ORBIT-BLACK",
    color: "Black",
    size: null,
    stockOnHand: 5,
    stockReserved: 0,
    active: true,
  });

  variantId = String(variant._id);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

// ============================================
// TEST HELPERS
// ============================================

async function createCustomerAgent() {
  const agent = request.agent(app);

  const csrf = await agent.get("/api/auth/csrf");

  expect(csrf.status).toBe(200);

  const registration = await agent
    .post("/api/auth/register")
    .set("X-CSRF-Token", csrf.body.csrfToken)
    .send(customer);

  expect(registration.status).toBe(201);

  const nextCsrf = await agent.get("/api/auth/csrf");

  expect(nextCsrf.status).toBe(200);

  return {
    agent,
    csrfToken: nextCsrf.body.csrfToken as string,
  };
}

async function addToCart(
  agent: ReturnType<typeof request.agent>,
  csrfToken: string,
  quantity: number,
) {
  const response = await agent
    .post("/api/cart/items")
    .set("X-CSRF-Token", csrfToken)
    .send({
      variantId,
      quantity,
    });

  expect(response.status).toBe(200);
}

// ============================================
// STRIPE CHECKOUT PREPARATION TESTS
// ============================================

describe("Stripe checkout preparation", () => {
  // TEST 1
  it("rejects unauthenticated checkout creation", async () => {
    const response = await request(app).post("/api/checkout/session").send({
      idempotencyKey: FIRST_KEY,
    });

    expect(response.status).toBe(403);

    expect(response.body.error.code).toBe("INVALID_CSRF_TOKEN");
  });

  // TEST 2
  it("rejects checkout creation without CSRF", async () => {
    const { agent } = await createCustomerAgent();

    const response = await agent.post("/api/checkout/session").send({
      idempotencyKey: FIRST_KEY,
    });

    expect(response.status).toBe(403);
  });

  // TEST 3
  it("rejects an empty cart", async () => {
    const { agent, csrfToken } = await createCustomerAgent();

    const response = await agent
      .post("/api/checkout/session")
      .set("X-CSRF-Token", csrfToken)
      .send({
        idempotencyKey: FIRST_KEY,
      });

    expect(response.status).toBe(400);

    expect(response.body.error.code).toBe("EMPTY_CART");

    expect(await Order.countDocuments()).toBe(0);
  });

  // TEST 4
  it("creates a pending order and reserves inventory", async () => {
    const { agent, csrfToken } = await createCustomerAgent();

    await addToCart(agent, csrfToken, 2);

    const response = await agent
      .post("/api/checkout/session")
      .set("X-CSRF-Token", csrfToken)
      .send({
        idempotencyKey: FIRST_KEY,
      });

    expect(response.status, JSON.stringify(response.body)).toBe(200);

    expect(response.body.data.state).toBe("ready");

    expect(response.body.data.checkoutUrl).toContain("checkout.stripe.com");

    const order = await Order.findOne({
      idempotencyKey: FIRST_KEY,
    });

    expect(order).not.toBeNull();

    expect(order?.status).toBe("pending_payment");

    expect(order?.reservationStatus).toBe("active");

    expect(order?.totalCents).toBe(25800);
    expect(order?.items).toHaveLength(1);
    expect(order?.items[0]?.quantity).toBe(2);

    const variant = await ProductVariant.findById(variantId);

    expect(variant?.stockOnHand).toBe(5);
    expect(variant?.stockReserved).toBe(2);

    expect(createStripeSession).toHaveBeenCalledTimes(1);
  });

  // TEST 5 — FIXED
  it("does not reserve stock twice when retried", async () => {
    const { agent, csrfToken } = await createCustomerAgent();

    await addToCart(agent, csrfToken, 2);

    // First request creates the order,
    // Stripe Session, and stock reservation.
    const first = await agent
      .post("/api/checkout/session")
      .set("X-CSRF-Token", csrfToken)
      .send({
        idempotencyKey: FIRST_KEY,
      });

    expect(first.status, JSON.stringify(first.body)).toBe(200);

    expect(first.body.data.state).toBe("ready");

    // Second request uses the same key.
    // Recovery should retrieve the existing
    // Stripe Session rather than create another.
    const second = await agent
      .post("/api/checkout/session")
      .set("X-CSRF-Token", csrfToken)
      .send({
        idempotencyKey: FIRST_KEY,
      });

    expect(second.status, JSON.stringify(second.body)).toBe(200);

    expect(second.body.data.state).toBe("ready");

    // Both requests must reference the same order.
    expect(second.body.data.orderId).toBe(first.body.data.orderId);

    expect(second.body.data.orderNumber).toBe(first.body.data.orderNumber);

    expect(second.body.data.checkoutUrl).toBe(first.body.data.checkoutUrl);

    // Exactly one order must exist.
    expect(await Order.countDocuments()).toBe(1);

    // The Stripe Session must only be created once.
    expect(createStripeSession).toHaveBeenCalledTimes(1);

    // Retrying must retrieve the existing session.
    expect(retrieveStripeSession).toHaveBeenCalledTimes(1);

    const order = await Order.findOne({
      idempotencyKey: FIRST_KEY,
    });

    expect(order).not.toBeNull();

    expect(order?.status).toBe("pending_payment");

    expect(order?.reservationStatus).toBe("active");

    const variant = await ProductVariant.findById(variantId);

    // The reservation is exactly 2, not 4.
    expect(variant?.stockOnHand).toBe(5);
    expect(variant?.stockReserved).toBe(2);
  });

  // TEST 6
  it("prevents a second active checkout", async () => {
    const { agent, csrfToken } = await createCustomerAgent();

    await addToCart(agent, csrfToken, 1);

    const first = await agent
      .post("/api/checkout/session")
      .set("X-CSRF-Token", csrfToken)
      .send({
        idempotencyKey: FIRST_KEY,
      });

    expect(first.status).toBe(200);

    const second = await agent
      .post("/api/checkout/session")
      .set("X-CSRF-Token", csrfToken)
      .send({
        idempotencyKey: SECOND_KEY,
      });

    expect(second.status).toBe(409);

    expect(second.body.error.code).toBe("ACTIVE_CHECKOUT_EXISTS");

    expect(await Order.countDocuments()).toBe(1);

    const variant = await ProductVariant.findById(variantId);

    expect(variant?.stockReserved).toBe(1);
  });

  // TEST 7
  it("rejects stock shortages without changing reservations", async () => {
    const { agent, csrfToken } = await createCustomerAgent();

    await addToCart(agent, csrfToken, 3);

    // Simulate stock reserved by another purchase.
    await ProductVariant.findByIdAndUpdate(variantId, {
      $set: {
        stockReserved: 4,
      },
    });

    const response = await agent
      .post("/api/checkout/session")
      .set("X-CSRF-Token", csrfToken)
      .send({
        idempotencyKey: FIRST_KEY,
      });

    expect(response.status).toBe(409);

    expect(response.body.error.code).toBe("INSUFFICIENT_STOCK");

    expect(await Order.countDocuments()).toBe(0);

    const variant = await ProductVariant.findById(variantId);

    expect(variant?.stockReserved).toBe(4);
  });

  // TEST 8
  it("preserves an order after an ambiguous Stripe failure", async () => {
    const { agent, csrfToken } = await createCustomerAgent();

    await addToCart(agent, csrfToken, 1);

    // Simulate a network timeout after the
    // database reservation was committed.
    vi.mocked(createStripeSession).mockRejectedValueOnce(
      new Error("Network interruption"),
    );

    const response = await agent
      .post("/api/checkout/session")
      .set("X-CSRF-Token", csrfToken)
      .send({
        idempotencyKey: FIRST_KEY,
      });

    expect(response.status).toBe(502);

    expect(response.body.error.code).toBe("STRIPE_SESSION_UNAVAILABLE");

    // An uncertain Stripe request must retain
    // its existing inventory reservation.
    const order = await Order.findOne({
      idempotencyKey: FIRST_KEY,
    });

    expect(order).not.toBeNull();

    expect(order?.status).toBe("pending_payment");

    expect(order?.reservationStatus).toBe("active");

    const variant = await ProductVariant.findById(variantId);

    expect(variant?.stockOnHand).toBe(5);
    expect(variant?.stockReserved).toBe(1);
  });
});
