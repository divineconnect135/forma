import mongoose from "mongoose";
import request from "supertest";

import { MongoMemoryServer } from "mongodb-memory-server";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { app } from "../app.js";
import { User } from "../models/User.js";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
import { Cart } from "../models/Cart.js";
import { Order } from "../models/Order.js";

let mongoServer: MongoMemoryServer;
let productId: string;
let variantId: string;

const customer = {
  name: "Checkout Test User",
  email: "checkout-user@example.com",
  password: "SecureTestPassword123!",
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  await mongoose.connect(mongoServer.getUri("forma_checkout_test"));

  await User.init();
  await Product.init();
  await ProductVariant.init();
  await Cart.init();
  await Order.init();
}, 120_000);

beforeEach(async () => {
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

  productId = String(product._id);

  const variant = await ProductVariant.create({
    productId: product._id,
    sku: "CHECKOUT-ORBIT-BLACK",
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

async function registerAgent() {
  const agent = request.agent(app);

  const csrf = await agent.get("/api/auth/csrf");

  expect(csrf.status).toBe(200);

  const response = await agent
    .post("/api/auth/register")
    .set("X-CSRF-Token", csrf.body.csrfToken)
    .send(customer);

  expect(response.status).toBe(201);

  // Registration rotates the CSRF token.
  const nextCsrf = await agent.get("/api/auth/csrf");

  expect(nextCsrf.status).toBe(200);

  return {
    agent,
    csrfToken: nextCsrf.body.csrfToken as string,
  };
}

async function addItem(
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

describe("Checkout preview API", () => {
  it("requires authentication", async () => {
    const response = await request(app).get("/api/checkout/preview");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects an empty cart", async () => {
    const { agent } = await registerAgent();

    const response = await agent.get("/api/checkout/preview");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("EMPTY_CART");
  });

  it("uses current database prices", async () => {
    const { agent, csrfToken } = await registerAgent();

    await addItem(agent, csrfToken, 2);

    const response = await agent.get("/api/checkout/preview");

    expect(response.status).toBe(200);
    expect(response.body.data.itemCount).toBe(2);
    expect(response.body.data.subtotalCents).toBe(25800);
    expect(response.body.data.currency).toBe("USD");

    expect(response.body.data.items[0]).toMatchObject({
      productName: "Orbit Desk Lamp",
      unitPriceCents: 12900,
      quantity: 2,
      canPurchase: true,
    });

    expect(response.body.data.totalCents).toBeNull();
    expect(response.body.data.taxCents).toBeNull();
    expect(response.body.data.shippingCents).toBeNull();
  });

  it("reflects price changes in MongoDB", async () => {
    const { agent, csrfToken } = await registerAgent();

    await addItem(agent, csrfToken, 1);

    await Product.findByIdAndUpdate(productId, {
      $set: {
        priceCents: 14900,
      },
    });

    const response = await agent.get("/api/checkout/preview");

    expect(response.status).toBe(200);
    expect(response.body.data.subtotalCents).toBe(14900);
  });

  it("rejects insufficient stock", async () => {
    const { agent, csrfToken } = await registerAgent();

    await addItem(agent, csrfToken, 3);

    // Another operation changes current availability.
    await ProductVariant.findByIdAndUpdate(variantId, {
      $set: {
        stockReserved: 4,
      },
    });

    const response = await agent.get("/api/checkout/preview");

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CART_ITEMS_UNAVAILABLE");
  });

  it("rejects archived products", async () => {
    const { agent, csrfToken } = await registerAgent();

    await addItem(agent, csrfToken, 1);

    await Product.findByIdAndUpdate(productId, {
      $set: {
        status: "archived",
      },
    });

    const response = await agent.get("/api/checkout/preview");

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CART_ITEMS_UNAVAILABLE");
  });

  it("does not create orders or reserve stock", async () => {
    const { agent, csrfToken } = await registerAgent();

    await addItem(agent, csrfToken, 2);

    const response = await agent.get("/api/checkout/preview");

    expect(response.status).toBe(200);

    const orderCount = await Order.countDocuments();
    expect(orderCount).toBe(0);

    const variant = await ProductVariant.findById(variantId);

    expect(variant?.stockOnHand).toBe(5);
    expect(variant?.stockReserved).toBe(0);
  });
});
