import mongoose from "mongoose";
import request from "supertest";

import { MongoMemoryServer } from "mongodb-memory-server";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../app.js";

let mongoServer: MongoMemoryServer;

const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// ---------------------------------------------
// TEST DATABASE SETUP
// ---------------------------------------------

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  await mongoose.connect(mongoServer.getUri("forma_phase7_regression"));

  process.env.STRIPE_WEBHOOK_SECRET = "whsec_phase7_regression_test";
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();

  await mongoServer?.stop();

  if (originalWebhookSecret === undefined) {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  } else {
    process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
  }
});

// ---------------------------------------------
// PHASE 7 REGRESSION TESTS
// ---------------------------------------------

describe("Phase 7 API regression checks", () => {
  // TEST 1
  it("preserves the liveness endpoint", async () => {
    const response = await request(app).get("/api/health/live");

    expect(response.status).toBe(200);

    expect(response.body.status).toBe("ok");
  });

  // TEST 2
  it("returns security headers", async () => {
    const response = await request(app).get("/api/health/live");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");

    expect(response.headers["x-powered-by"]).toBeUndefined();

    expect(response.headers["x-request-id"]).toBeDefined();
  });

  // TEST 3
  it("protects customer order history", async () => {
    const response = await request(app).get("/api/orders");

    expect(response.status).toBe(401);

    expect(response.body.error.code).toBe("UNAUTHENTICATED");

    expect(response.headers["cache-control"]).toBe("no-store");
  });

  // TEST 4
  it("protects checkout recovery", async () => {
    const response = await request(app).get("/api/checkout/active");

    expect(response.status).toBe(401);
  });

  // TEST 5
  it("protects admin product management", async () => {
    const response = await request(app).get("/api/admin/products");

    expect(response.status).toBe(401);

    expect(response.headers["cache-control"]).toBe("no-store");
  });

  // TEST 6
  it("protects administrative order information", async () => {
    const response = await request(app).get("/api/admin/orders");

    expect(response.status).toBe(401);
  });

  // TEST 7
  it("rejects malformed JSON safely", async () => {
    const response = await request(app)
      .post("/api/cart/items")
      .set("Content-Type", "application/json")
      .send('{"quantity":');

    expect(response.status).toBe(400);

    expect(response.body.error.code).toBe("INVALID_JSON");
  });

  // TEST 8
  it("rejects oversized JSON bodies", async () => {
    const response = await request(app)
      .post("/api/cart/items")
      .set("Content-Type", "application/json")
      .send(
        JSON.stringify({
          payload: "x".repeat(120_000),
        }),
      );

    expect(response.status).toBe(413);

    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  // TEST 9
  it("rejects spoofed Stripe webhook signatures", async () => {
    const response = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", "t=1234567890,v1=invalid")
      .send(
        JSON.stringify({
          id: "evt_fake_phase7",
          object: "event",
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_test_fake",
              object: "checkout.session",
            },
          },
        }),
      );

    expect(response.status).toBe(400);

    expect(response.body.error.code).toBe("INVALID_SIGNATURE");
  });

  // TEST 10
  it("preserves structured API 404 errors", async () => {
    const response = await request(app).get("/api/nonexistent-phase7-route");

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "API route not found",
      },
    });
  });
});
