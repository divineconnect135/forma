import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { app } from "../app.js";
import { User } from "../models/User.js";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
import { Cart } from "../models/Cart.js";

let mongoServer: MongoMemoryServer;
let variantId: string;

const customer = {
  name: "Cart Test User",
  email: "cart-user@example.com",
  password: "SecureTestPassword123!",
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  await mongoose.connect(mongoServer.getUri("forma_cart_test"));

  await User.init();
  await Product.init();
  await ProductVariant.init();
  await Cart.init();
}, 120_000);

beforeEach(async () => {
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

  const variant = await ProductVariant.create({
    productId: product._id,
    sku: "ORBIT-BLACK-TEST",
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

async function registerAgent(email = customer.email) {
  const agent = request.agent(app);

  const csrfResponse = await agent.get("/api/auth/csrf");

  expect(csrfResponse.status).toBe(200);

  const registered = await agent
    .post("/api/auth/register")
    .set("X-CSRF-Token", csrfResponse.body.csrfToken)
    .send({
      ...customer,
      email,
    });

  expect(registered.status).toBe(201);

  // Registration rotates the CSRF token.
  const sessionCsrf = await agent.get("/api/auth/csrf");

  expect(sessionCsrf.status).toBe(200);

  return {
    agent,
    csrfToken: sessionCsrf.body.csrfToken as string,
  };
}

describe("Shopping cart API", () => {
  it("blocks unauthenticated cart access", async () => {
    const response = await request(app).get("/api/cart");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("requires CSRF on cart modifications", async () => {
    const { agent } = await registerAgent();

    const response = await agent.post("/api/cart/items").send({
      variantId,
      quantity: 1,
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("INVALID_CSRF_TOKEN");
  });

  it("previews guest carts using server prices", async () => {
    const agent = request.agent(app);

    const csrf = await agent.get("/api/auth/csrf");

    const response = await agent
      .post("/api/cart/preview")
      .set("X-CSRF-Token", csrf.body.csrfToken)
      .send({
        items: [
          {
            variantId,
            quantity: 2,
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.subtotalCents).toBe(25800);
    expect(response.body.data.itemCount).toBe(2);
  });

  it("adds an item and persists it", async () => {
    const { agent, csrfToken } = await registerAgent();

    const response = await agent
      .post("/api/cart/items")
      .set("X-CSRF-Token", csrfToken)
      .send({
        variantId,
        quantity: 2,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.itemCount).toBe(2);
    expect(response.body.data.subtotalCents).toBe(25800);

    const saved = await agent.get("/api/cart");

    expect(saved.status).toBe(200);
    expect(saved.body.data.items).toHaveLength(1);
    expect(saved.body.data.items[0].quantity).toBe(2);
  });

  it("updates and removes items", async () => {
    const { agent, csrfToken } = await registerAgent();

    const added = await agent
      .post("/api/cart/items")
      .set("X-CSRF-Token", csrfToken)
      .send({
        variantId,
        quantity: 1,
      });

    expect(added.status).toBe(200);

    const updated = await agent
      .patch(`/api/cart/items/${variantId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({
        quantity: 3,
      });

    expect(updated.status).toBe(200);
    expect(updated.body.data.itemCount).toBe(3);

    const removed = await agent
      .delete(`/api/cart/items/${variantId}`)
      .set("X-CSRF-Token", csrfToken);

    expect(removed.status).toBe(200);
    expect(removed.body.data.items).toHaveLength(0);
  });

  it("rejects quantities exceeding available stock", async () => {
    const { agent, csrfToken } = await registerAgent();

    // Only 5 units are available.
    const response = await agent
      .post("/api/cart/items")
      .set("X-CSRF-Token", csrfToken)
      .send({
        variantId,
        quantity: 6,
      });

    const diagnostic = {
      status: response.status,
      contentType: response.headers["content-type"],
      body: response.body,
      text: response.text,
    };

    // Show the actual response if the API sends HTML
    // or unexpected JSON instead of our error contract.
    expect(response.status, JSON.stringify(diagnostic, null, 2)).toBe(409);

    expect(response.body, JSON.stringify(diagnostic, null, 2)).toMatchObject({
      error: {
        code: "INSUFFICIENT_STOCK",
      },
    });

    // Rejected additions must not change the cart.
    const cart = await agent.get("/api/cart");

    expect(cart.status).toBe(200);
    expect(cart.body.data.items).toHaveLength(0);
  });

  it("rejects client-supplied prices", async () => {
    const { agent, csrfToken } = await registerAgent();

    const response = await agent
      .post("/api/cart/items")
      .set("X-CSRF-Token", csrfToken)
      .send({
        variantId,
        quantity: 1,
        priceCents: 1,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("merges a guest cart exactly once", async () => {
    const { agent, csrfToken } = await registerAgent();

    const payload = {
      mergeId: "123e4567-e89b-42d3-a456-426614174000",
      items: [
        {
          variantId,
          quantity: 2,
        },
      ],
    };

    const first = await agent
      .post("/api/cart/merge")
      .set("X-CSRF-Token", csrfToken)
      .send(payload);

    expect(first.status).toBe(200);
    expect(first.body.data.itemCount).toBe(2);

    const second = await agent
      .post("/api/cart/merge")
      .set("X-CSRF-Token", csrfToken)
      .send(payload);

    expect(second.status).toBe(200);
    expect(second.body.data.itemCount).toBe(2);
  });

  it("keeps customer carts separate", async () => {
    const first = await registerAgent("first@example.com");

    const added = await first.agent
      .post("/api/cart/items")
      .set("X-CSRF-Token", first.csrfToken)
      .send({
        variantId,
        quantity: 2,
      });

    expect(added.status).toBe(200);

    const second = await registerAgent("second@example.com");

    const secondCart = await second.agent.get("/api/cart");

    expect(secondCart.status).toBe(200);
    expect(secondCart.body.data.items).toHaveLength(0);

    const firstCart = await first.agent.get("/api/cart");

    expect(firstCart.status).toBe(200);
    expect(firstCart.body.data.itemCount).toBe(2);
  });

  it("rejects invalid variant IDs", async () => {
    const { agent, csrfToken } = await registerAgent();

    const response = await agent
      .post("/api/cart/items")
      .set("X-CSRF-Token", csrfToken)
      .send({
        variantId: "invalid-id",
        quantity: 1,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
