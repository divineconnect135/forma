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

const password = "SecureTestPassword123!";

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  await mongoose.connect(mongoServer.getUri("forma_admin_test"));

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
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

async function registerUser(email: string) {
  const agent = request.agent(app);

  const csrf = await agent.get("/api/auth/csrf");

  expect(csrf.status).toBe(200);

  const response = await agent
    .post("/api/auth/register")
    .set("X-CSRF-Token", csrf.body.csrfToken)
    .send({
      name: "Admin Test User",
      email,
      password,
    });

  expect(response.status).toBe(201);

  return {
    agent,
    userId: response.body.data.user.id as string,
  };
}

async function promoteUserToAdmin(userId: string) {
  await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        role: "admin",
      },
    },
    { runValidators: true },
  );
}

async function seedDashboardData(customerId: string) {
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

  await Product.create({
    name: "Archived Chair",
    slug: "archived-chair",
    description: "Archived example product",
    category: "furniture",
    priceCents: 34900,
    currency: "USD",
    images: [],
    status: "archived",
    featured: false,
  });

  const lowStockVariant = await ProductVariant.create({
    productId: product._id,
    sku: "ADMIN-LAMP-BLACK",
    color: "Black",
    size: null,
    stockOnHand: 8,
    stockReserved: 5,
    active: true,
  });

  await ProductVariant.create({
    productId: product._id,
    sku: "ADMIN-LAMP-IVORY",
    color: "Ivory",
    size: null,
    stockOnHand: 1,
    stockReserved: 1,
    active: true,
  });

  const orderItem = {
    productId: product._id,
    variantId: lowStockVariant._id,
    productName: product.name,
    productSlug: product.slug,
    sku: lowStockVariant.sku,
    color: lowStockVariant.color,
    size: null,
    quantity: 1,
    unitPriceCents: 12900,
    lineTotalCents: 12900,
  };

  await Order.create({
    orderNumber: "FM-ADMIN-PAID",

    userId: new mongoose.Types.ObjectId(customerId),

    items: [orderItem],

    currency: "USD",
    subtotalCents: 12900,
    shippingCents: 0,
    taxCents: 0,
    totalCents: 12900,

    status: "paid",
    reservationStatus: "committed",

    paidAt: new Date(),

    idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
  });

  await Order.create({
    orderNumber: "FM-ADMIN-PENDING",

    userId: new mongoose.Types.ObjectId(customerId),

    items: [orderItem],

    currency: "USD",
    subtotalCents: 12900,
    shippingCents: 0,
    taxCents: 0,
    totalCents: 12900,

    status: "pending_payment",
    reservationStatus: "active",

    reservationExpiresAt: new Date(Date.now() + 35 * 60 * 1000),

    idempotencyKey: "123e4567-e89b-42d3-a456-426614174001",
  });
}

describe("Admin dashboard API", () => {
  it("rejects unauthenticated access", async () => {
    const response = await request(app).get("/api/admin/overview");

    expect(response.status).toBe(401);

    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects normal customer access", async () => {
    const customer = await registerUser("customer-admin-test@example.com");

    const response = await customer.agent.get("/api/admin/overview");

    expect(response.status).toBe(403);

    expect(response.body.error.code).toBe("ADMIN_ACCESS_REQUIRED");
  });

  it("returns dashboard statistics for an administrator", async () => {
    const admin = await registerUser("admin-dashboard@example.com");

    await promoteUserToAdmin(admin.userId);

    const customer = await registerUser("order-buyer@example.com");

    await seedDashboardData(customer.userId);

    const response = await admin.agent.get("/api/admin/overview");

    expect(response.status).toBe(200);

    expect(response.body.data.products).toEqual({
      total: 2,
      active: 1,
    });

    expect(response.body.data.inventory).toEqual({
      activeVariants: 2,
      lowStockVariants: 1,
      outOfStockVariants: 1,
    });

    expect(response.body.data.orders).toEqual({
      total: 2,
      pending: 1,
      paid: 1,
    });

    expect(response.body.data.customers.total).toBe(1);

    expect(response.body.data.paidSales).toEqual({
      currency: "USD",
      grossCents: 12900,
      testMode: true,
    });

    expect(response.body.data.recentOrders).toHaveLength(2);

    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("does not expose customer credentials", async () => {
    const admin = await registerUser("privacy-admin@example.com");

    await promoteUserToAdmin(admin.userId);

    const response = await admin.agent.get("/api/admin/overview");

    expect(response.status).toBe(200);

    const responseText = JSON.stringify(response.body);

    expect(responseText.includes("passwordHash")).toBe(false);

    expect(responseText.includes("sessionId")).toBe(false);

    expect(responseText.includes(password)).toBe(false);
  });

  it("revokes access after admin role is removed", async () => {
    const admin = await registerUser("revoked-admin@example.com");

    await promoteUserToAdmin(admin.userId);

    const allowed = await admin.agent.get("/api/admin/overview");

    expect(allowed.status).toBe(200);

    // The account stays logged in, but loses
    // administrator permission immediately.
    await User.findByIdAndUpdate(
      admin.userId,
      {
        $set: {
          role: "customer",
        },
      },
      { runValidators: true },
    );

    const denied = await admin.agent.get("/api/admin/overview");

    expect(denied.status).toBe(403);

    expect(denied.body.error.code).toBe("ADMIN_ACCESS_REQUIRED");
  });
});
