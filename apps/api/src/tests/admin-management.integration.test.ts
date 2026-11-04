import mongoose from "mongoose";
import request from "supertest";

import { MongoMemoryReplSet } from "mongodb-memory-server";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { app } from "../app.js";

import { User } from "../models/User.js";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
import { Order } from "../models/Order.js";
import { Cart } from "../models/Cart.js";
import { AdminAudit } from "../models/AdminAudit.js";

let mongoServer: MongoMemoryReplSet;

const PASSWORD = "SecureTestPassword123!";

const productInput = {
  name: "Modern Table Lamp",
  slug: "modern-table-lamp",
  description: "Minimal modern table lamp for a desk",
  category: "lighting",
  priceCents: 12900,
  featured: false,
  images: [],
  modelUrl: null,
  status: "archived",
};

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });

  await mongoose.connect(mongoServer.getUri("forma_admin_management_test"));

  await User.init();
  await Product.init();
  await ProductVariant.init();
  await Order.init();
  await Cart.init();
  await AdminAudit.init();
}, 120_000);

beforeEach(async () => {
  await AdminAudit.deleteMany({});
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
      password: PASSWORD,
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

async function registerAdmin() {
  const account = await registerUser("management-admin@example.com");

  await User.findByIdAndUpdate(
    account.userId,
    { $set: { role: "admin" } },
    { runValidators: true },
  );

  return account;
}

async function createProduct(admin: Awaited<ReturnType<typeof registerAdmin>>) {
  const response = await admin.agent
    .post("/api/admin/products")
    .set("X-CSRF-Token", admin.csrfToken)
    .send(productInput);

  expect(response.status, JSON.stringify(response.body)).toBe(201);

  return response.body.data.id as string;
}

describe("Admin management", () => {
  it("denies unauthenticated access", async () => {
    const response = await request(app).get("/api/admin/products");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("denies customer access", async () => {
    const customer = await registerUser("ordinary-customer@example.com");

    const response = await customer.agent.get("/api/admin/products");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ADMIN_ACCESS_REQUIRED");
  });

  it("requires CSRF for product creation", async () => {
    const admin = await registerAdmin();

    const response = await admin.agent
      .post("/api/admin/products")
      .send(productInput);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("INVALID_CSRF_TOKEN");
  });

  it("creates and audits a product", async () => {
    const admin = await registerAdmin();

    const productId = await createProduct(admin);

    const product = await Product.findById(productId);

    expect(product?.name).toBe("Modern Table Lamp");
    expect(product?.status).toBe("archived");

    const audit = await AdminAudit.findOne({
      action: "product.created",
    });

    expect(audit).not.toBeNull();
    expect(String(audit?.resourceId)).toBe(productId);
  });

  it("updates price and featured status", async () => {
    const admin = await registerAdmin();
    const productId = await createProduct(admin);

    const response = await admin.agent
      .patch(`/api/admin/products/${productId}`)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({
        priceCents: 14900,
        featured: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.priceCents).toBe(14900);
    expect(response.body.data.featured).toBe(true);

    expect(
      await AdminAudit.countDocuments({
        action: "product.updated",
      }),
    ).toBe(1);
  });

  it("rejects unknown product fields", async () => {
    const admin = await registerAdmin();
    const productId = await createProduct(admin);

    const response = await admin.agent
      .patch(`/api/admin/products/${productId}`)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({
        stockReserved: 0,
        status: "active",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("archives without deleting products", async () => {
    const admin = await registerAdmin();
    const productId = await createProduct(admin);

    await admin.agent
      .patch(`/api/admin/products/${productId}`)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({ status: "active" });

    const response = await admin.agent
      .post(`/api/admin/products/${productId}/archive`)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("archived");

    expect(
      await Product.countDocuments({
        _id: productId,
      }),
    ).toBe(1);
  });

  it("creates variants with zero initial stock", async () => {
    const admin = await registerAdmin();
    const productId = await createProduct(admin);

    const response = await admin.agent
      .post(`/api/admin/products/${productId}/variants`)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({
        sku: "MODERN-BLACK",
        color: "Black",
        size: null,
      });

    expect(response.status).toBe(201);

    expect(response.body.data).toMatchObject({
      sku: "MODERN-BLACK",
      stockOnHand: 0,
      stockReserved: 0,
      availableQuantity: 0,
    });

    const variant = await ProductVariant.findOne({
      sku: "MODERN-BLACK",
    });

    expect(variant).not.toBeNull();
  });

  it("prevents stock reductions below reservations", async () => {
    const admin = await registerAdmin();
    const productId = await createProduct(admin);

    const variant = await ProductVariant.create({
      productId,
      sku: "STOCK-GUARD-TEST",
      color: "Black",
      size: null,
      stockOnHand: 8,
      stockReserved: 5,
      active: true,
    });

    const response = await admin.agent
      .post(`/api/admin/variants/${String(variant._id)}/adjust-stock`)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({
        delta: -4,
        reason: "Damaged stock adjustment",
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("STOCK_ADJUSTMENT_REJECTED");

    const unchanged = await ProductVariant.findById(variant._id);

    expect(unchanged?.stockOnHand).toBe(8);
    expect(unchanged?.stockReserved).toBe(5);
  });

  it("adjusts stock and records the reason", async () => {
    const admin = await registerAdmin();
    const productId = await createProduct(admin);

    const variant = await ProductVariant.create({
      productId,
      sku: "STOCK-RECEIPT-TEST",
      color: "Ivory",
      size: null,
      stockOnHand: 2,
      stockReserved: 0,
      active: true,
    });

    const response = await admin.agent
      .post(`/api/admin/variants/${String(variant._id)}/adjust-stock`)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({
        delta: 10,
        reason: "Received new warehouse stock",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.stockOnHand).toBe(12);

    const audit = await AdminAudit.findOne({
      action: "inventory.adjusted",
    });

    expect(audit?.metadata.delta).toBe(10);
  });

  it("blocks fulfillment before payment", async () => {
    const admin = await registerAdmin();
    const productId = await createProduct(admin);

    const variant = await ProductVariant.create({
      productId,
      sku: "PENDING-ORDER-TEST",
      color: "Black",
      stockOnHand: 4,
      stockReserved: 1,
      active: true,
    });

    const order = await Order.create({
      orderNumber: "FM-ADMIN-PENDING-TEST",
      userId: new mongoose.Types.ObjectId(),
      items: [
        {
          productId,
          variantId: variant._id,
          productName: "Modern Table Lamp",
          productSlug: "modern-table-lamp",
          sku: variant.sku,
          color: "Black",
          size: null,
          quantity: 1,
          unitPriceCents: 12900,
          lineTotalCents: 12900,
        },
      ],
      subtotalCents: 12900,
      shippingCents: 0,
      taxCents: 0,
      totalCents: 12900,
      status: "pending_payment",
      reservationStatus: "active",
      idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
    });

    const response = await admin.agent
      .patch(`/api/admin/orders/${String(order._id)}/fulfillment`)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({ status: "processing" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("PAYMENT_NOT_CONFIRMED");
  });

  it("updates paid-order fulfillment sequentially", async () => {
    const admin = await registerAdmin();
    const productId = await createProduct(admin);

    const variant = await ProductVariant.create({
      productId,
      sku: "PAID-ORDER-TEST",
      color: "Black",
      stockOnHand: 3,
      stockReserved: 0,
      active: true,
    });

    const order = await Order.create({
      orderNumber: "FM-ADMIN-PAID-TEST",
      userId: new mongoose.Types.ObjectId(),
      items: [
        {
          productId,
          variantId: variant._id,
          productName: "Modern Table Lamp",
          productSlug: "modern-table-lamp",
          sku: variant.sku,
          color: "Black",
          size: null,
          quantity: 1,
          unitPriceCents: 12900,
          lineTotalCents: 12900,
        },
      ],
      subtotalCents: 12900,
      shippingCents: 0,
      taxCents: 0,
      totalCents: 12900,
      status: "paid",
      reservationStatus: "committed",
      paidAt: new Date(),
      idempotencyKey: "123e4567-e89b-42d3-a456-426614174001",
    });

    const path = `/api/admin/orders/${String(order._id)}/fulfillment`;

    const skip = await admin.agent
      .patch(path)
      .set("X-CSRF-Token", admin.csrfToken)
      .send({ status: "delivered" });

    expect(skip.status).toBe(409);

    for (const status of ["processing", "shipped", "delivered"]) {
      const response = await admin.agent
        .patch(path)
        .set("X-CSRF-Token", admin.csrfToken)
        .send({ status });

      expect(response.status).toBe(200);
      expect(response.body.data.fulfillmentStatus).toBe(status);
    }

    const savedOrder = await Order.findById(order._id);

    expect(savedOrder?.status).toBe("paid");
    expect(savedOrder?.fulfillmentStatus).toBe("delivered");

    expect(
      await AdminAudit.countDocuments({
        action: "order.fulfillment_updated",
      }),
    ).toBe(3);
  });

  it("shows customers without credentials", async () => {
    const admin = await registerAdmin();

    await registerUser("customer-record@example.com");

    const response = await admin.agent.get("/api/admin/customers");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);

    const text = JSON.stringify(response.body);

    expect(text).not.toContain("passwordHash");
    expect(text).not.toContain(PASSWORD);
  });

  it("exposes audit history to admins only", async () => {
    const admin = await registerAdmin();
    await createProduct(admin);

    const response = await admin.agent.get("/api/admin/audit");

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);

    expect(response.body.data[0]).toHaveProperty("action");

    const customer = await registerUser("audit-denied@example.com");

    const denied = await customer.agent.get("/api/admin/audit");

    expect(denied.status).toBe(403);
  });
});
