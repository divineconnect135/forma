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
import { Cart } from "../models/Cart.js";
import { Order } from "../models/Order.js";

import {
  expireStripeSession,
  retrieveStripeSession,
} from "../services/stripe.service.js";

import { settleStripeSession } from "../services/orderSettlement.service.js";

// Mock Stripe network operations.
// Actual Stripe API requests are not made in tests.
vi.mock("../services/stripe.service.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/stripe.service.js")>();

  return {
    ...actual,
    retrieveStripeSession: vi.fn(),
    expireStripeSession: vi.fn(),
  };
});

// Temporary MongoDB replica set.
let mongoServer: MongoMemoryReplSet;

let productId: mongoose.Types.ObjectId;
let variantId: mongoose.Types.ObjectId;

let orderCounter = 0;

const customerPassword = "SecureTestPassword123!";

// Set up MongoDB before running tests.
beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });

  await mongoose.connect(mongoServer.getUri("forma_orders_test"));

  await User.init();
  await Product.init();
  await ProductVariant.init();
  await Cart.init();
  await Order.init();
}, 120_000);

// Reset database between tests.
beforeEach(async () => {
  vi.mocked(retrieveStripeSession).mockReset();
  vi.mocked(expireStripeSession).mockReset();

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
    status: "active",
    featured: true,
    images: [],
  });

  productId = product._id;

  const variant = await ProductVariant.create({
    productId: product._id,
    sku: "ORDER-LAMP-BLACK",
    color: "Black",
    size: null,
    stockOnHand: 5,
    stockReserved: 2,
    active: true,
  });

  variantId = variant._id;
});

// Disconnect after all tests complete.
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

// Register a test customer and establish a session.
async function registerCustomer(email: string) {
  const agent = request.agent(app);

  const csrf = await agent.get("/api/auth/csrf");

  expect(csrf.status).toBe(200);

  const registration = await agent
    .post("/api/auth/register")
    .set("X-CSRF-Token", csrf.body.csrfToken)
    .send({
      name: "Order Test Customer",
      email,
      password: customerPassword,
    });

  expect(registration.status).toBe(201);

  // Registration rotates the CSRF token.
  const sessionCsrf = await agent.get("/api/auth/csrf");

  expect(sessionCsrf.status).toBe(200);

  return {
    agent,
    userId: registration.body.data.user.id as string,
    csrfToken: sessionCsrf.body.csrfToken as string,
  };
}

// Create a test order directly in MongoDB.
async function createTestOrder(
  userId: string,
  status: "pending_payment" | "paid" = "pending_payment",
) {
  orderCounter++;

  const order = await Order.create({
    orderNumber: `FM-ORDER-${orderCounter}`,

    userId: new mongoose.Types.ObjectId(userId),

    items: [
      {
        productId,
        variantId,
        productName: "Orbit Desk Lamp",
        productSlug: "orbit-desk-lamp",
        sku: "ORDER-LAMP-BLACK",
        color: "Black",
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

    status,

    reservationStatus: status === "paid" ? "committed" : "active",

    reservationExpiresAt: new Date(Date.now() + 35 * 60 * 1000),

    idempotencyKey: new mongoose.Types.ObjectId().toHexString(),
  });

  const sessionId = `cs_test_${String(order._id)}`;

  await Order.updateOne(
    { _id: order._id },
    {
      $set: {
        stripeCheckoutSessionId: sessionId,
      },
    },
  );

  return {
    orderId: String(order._id),
    sessionId,
    orderNumber: order.orderNumber,
  };
}

// Create a simplified Stripe Checkout Session.
//
// IMPORTANT:
// This is test-only mock data. Stripe's actual
// Session type contains many additional fields.
//
// Use "as unknown as" because the test deliberately
// provides only the properties that our settlement
// service needs.
//
// Do not use this technique to bypass validation
// of real Stripe API responses.
function makeStripeSession(
  order: {
    orderId: string;
    sessionId: string;
    orderNumber: string;
  },
  options: {
    status: "open" | "complete" | "expired";
    paymentStatus: "paid" | "unpaid";
  },
): Stripe.Checkout.Session {
  const mockSession = {
    id: order.sessionId,

    object: "checkout.session",

    livemode: false,

    mode: "payment",

    client_reference_id: order.orderId,

    metadata: {
      orderId: order.orderId,
      orderNumber: order.orderNumber,
    },

    currency: "usd",

    amount_total: 25800,

    status: options.status,

    payment_status: options.paymentStatus,

    expires_at: Math.floor(Date.now() / 1000) + 2100,

    payment_intent: options.paymentStatus === "paid" ? "pi_test_paid" : null,
  };

  return mockSession as unknown as Stripe.Checkout.Session;
}

// Customer order integration tests.
describe("Customer order management", () => {
  it("requires authentication", async () => {
    const response = await request(app).get("/api/orders");

    expect(response.status).toBe(401);

    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns the customer's order history", async () => {
    const customer = await registerCustomer("history@example.com");

    await createTestOrder(customer.userId);

    const response = await customer.agent.get("/api/orders");

    expect(response.status).toBe(200);

    expect(response.body.data).toHaveLength(1);

    expect(response.body.pagination.total).toBe(1);

    expect(response.body.data[0]).toMatchObject({
      status: "pending_payment",
      itemCount: 2,
      totalCents: 25800,
    });
  });

  it("does not expose another customer's orders", async () => {
    const first = await registerCustomer("first-order@example.com");

    const second = await registerCustomer("second-order@example.com");

    const saved = await createTestOrder(first.userId);

    const list = await second.agent.get("/api/orders");

    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(0);

    const details = await second.agent.get(`/api/orders/${saved.orderId}`);

    expect(details.status).toBe(404);
  });

  it("returns saved order item snapshots", async () => {
    const customer = await registerCustomer("snapshot@example.com");

    const saved = await createTestOrder(customer.userId);

    // Changing the current product price should
    // not change the historical order snapshot.
    await Product.findByIdAndUpdate(productId, {
      $set: {
        priceCents: 14900,
      },
    });

    const response = await customer.agent.get(`/api/orders/${saved.orderId}`);

    expect(response.status).toBe(200);

    expect(response.body.data.items[0]).toMatchObject({
      productName: "Orbit Desk Lamp",
      quantity: 2,
      unitPriceCents: 12900,
      lineTotalCents: 25800,
    });

    expect(response.body.data.totalCents).toBe(25800);
  });

  it("rejects invalid pagination", async () => {
    const customer = await registerCustomer("pagination@example.com");

    const response = await customer.agent.get("/api/orders?page=-1");

    expect(response.status).toBe(400);

    expect(response.body.error.code).toBe("INVALID_QUERY");
  });

  it("requires CSRF for cancellation", async () => {
    const customer = await registerCustomer("csrf-cancel@example.com");

    const saved = await createTestOrder(customer.userId);

    const response = await customer.agent
      .post(`/api/orders/${saved.orderId}/cancel`)
      .send({});

    expect(response.status).toBe(403);

    expect(response.body.error.code).toBe("INVALID_CSRF_TOKEN");
  });

  it("expires an open Stripe checkout and releases inventory", async () => {
    const customer = await registerCustomer("cancel@example.com");

    const saved = await createTestOrder(customer.userId);

    const openSession = makeStripeSession(saved, {
      status: "open",
      paymentStatus: "unpaid",
    });

    const expiredSession = makeStripeSession(saved, {
      status: "expired",
      paymentStatus: "unpaid",
    });

    vi.mocked(retrieveStripeSession).mockResolvedValue(openSession);

    vi.mocked(expireStripeSession).mockResolvedValue(expiredSession);

    const response = await customer.agent
      .post(`/api/orders/${saved.orderId}/cancel`)
      .set("X-CSRF-Token", customer.csrfToken)
      .send({});

    expect(response.status).toBe(200);

    expect(response.body.data.status).toBe("expired");

    const stock = await ProductVariant.findById(variantId);

    expect(stock?.stockOnHand).toBe(5);
    expect(stock?.stockReserved).toBe(0);

    const order = await Order.findById(saved.orderId);

    expect(order?.reservationStatus).toBe("released");
  });

  it("does not expire an already paid order", async () => {
    const customer = await registerCustomer("paid-cancel@example.com");

    const saved = await createTestOrder(customer.userId, "paid");

    const response = await customer.agent
      .post(`/api/orders/${saved.orderId}/cancel`)
      .set("X-CSRF-Token", customer.csrfToken)
      .send({});

    expect(response.status).toBe(409);

    expect(response.body.error.code).toBe("ORDER_NOT_CANCELLABLE");

    expect(expireStripeSession).not.toHaveBeenCalled();
  });

  it("does not cancel a payment completed concurrently", async () => {
    const customer = await registerCustomer("concurrent@example.com");

    const saved = await createTestOrder(customer.userId);

    vi.mocked(retrieveStripeSession).mockResolvedValue(
      makeStripeSession(saved, {
        status: "complete",
        paymentStatus: "paid",
      }),
    );

    const response = await customer.agent
      .post(`/api/orders/${saved.orderId}/cancel`)
      .set("X-CSRF-Token", customer.csrfToken)
      .send({});

    expect(response.status).toBe(200);

    expect(response.body.data.status).toBe("paid");

    expect(expireStripeSession).not.toHaveBeenCalled();

    const stock = await ProductVariant.findById(variantId);

    expect(stock?.stockOnHand).toBe(3);
    expect(stock?.stockReserved).toBe(0);
  });

  it("removes purchased items but preserves unrelated cart items", async () => {
    const customer = await registerCustomer("cart-cleanup@example.com");

    const saved = await createTestOrder(customer.userId);

    const extraVariant = await ProductVariant.create({
      productId,
      sku: "ORDER-LAMP-BRASS",
      color: "Brass",
      size: null,
      stockOnHand: 10,
      stockReserved: 0,
      active: true,
    });

    await Cart.create({
      userId: new mongoose.Types.ObjectId(customer.userId),

      items: [
        {
          variantId,
          quantity: 2,
        },
        {
          variantId: extraVariant._id,
          quantity: 1,
        },
      ],
    });

    const result = await settleStripeSession(
      makeStripeSession(saved, {
        status: "complete",
        paymentStatus: "paid",
      }),
      "reconciliation",
    );

    expect(result).toBe("paid");

    const cart = await Cart.findOne({
      userId: customer.userId,
    });

    expect(cart?.items).toHaveLength(1);

    expect(String(cart?.items[0]?.variantId)).toBe(String(extraVariant._id));
  });

  it("preserves cart lines changed after checkout", async () => {
    const customer = await registerCustomer("changed-cart@example.com");

    const saved = await createTestOrder(customer.userId);

    // Customer changes the lamp quantity after
    // the pending order is created.
    await Cart.create({
      userId: new mongoose.Types.ObjectId(customer.userId),

      items: [
        {
          variantId,
          quantity: 3,
        },
      ],
    });

    const result = await settleStripeSession(
      makeStripeSession(saved, {
        status: "complete",
        paymentStatus: "paid",
      }),
      "reconciliation",
    );

    expect(result).toBe("paid");

    const cart = await Cart.findOne({
      userId: customer.userId,
    });

    expect(cart?.items).toHaveLength(1);

    expect(cart?.items[0]?.quantity).toBe(3);

    const stock = await ProductVariant.findById(variantId);

    expect(stock?.stockOnHand).toBe(3);
    expect(stock?.stockReserved).toBe(0);
  });
});
