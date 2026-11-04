import mongoose from "mongoose";
import request from "supertest";

import { MongoMemoryServer } from "mongodb-memory-server";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../app.js";

let mongoServer: MongoMemoryServer;

const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  await mongoose.connect(mongoServer.getUri("forma_api_security_test"));

  process.env.STRIPE_WEBHOOK_SECRET = "whsec_forma_security_test";
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

describe("API security hardening", () => {
  it("sets security-related response headers", async () => {
    const response = await request(app).get("/api/health/live");

    expect(response.status).toBe(200);

    expect(response.headers["x-content-type-options"]).toBe("nosniff");

    expect(response.headers["x-powered-by"]).toBeUndefined();

    expect(response.headers["x-request-id"]).toBeDefined();
  });

  it("returns a safe error for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/cart/items")
      .set("Content-Type", "application/json")
      .send('{"quantity":');

    expect(response.status).toBe(400);

    expect(response.body.error.code).toBe("INVALID_JSON");

    expect(response.body.error.message).toBe(
      "Request body contains invalid JSON.",
    );
  });

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

  it("prevents caching of private admin responses", async () => {
    const response = await request(app).get("/api/admin/overview");

    expect(response.status).toBe(401);

    expect(response.headers["cache-control"]).toBe("no-store");

    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("prevents caching of private cart responses", async () => {
    const response = await request(app).get("/api/cart");

    expect(response.status).toBe(401);

    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("rejects unsigned Stripe webhook requests", async () => {
    const response = await request(app)
      .post("/api/webhooks/stripe")
      .set("Content-Type", "application/json")
      .send(
        JSON.stringify({
          id: "evt_unsigned",
          object: "event",
          type: "checkout.session.completed",
        }),
      );

    expect(response.status).toBe(400);

    expect(response.body.error.code).toBe("INVALID_WEBHOOK");
  });

  it("returns structured 404 responses", async () => {
    const response = await request(app).get("/api/this-route-does-not-exist");

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "API route not found",
      },
    });
  });

  it("applies checkout request limits", async () => {
    const response = await request(app)
      .post("/api/checkout/session")
      .set("Content-Type", "application/json")
      .send({});

    // CSRF prevents the unauthenticated POST.
    // The rate limiter runs before CSRF and
    // adds its standard response headers.
    expect(response.status).toBe(403);

    expect(response.headers["ratelimit"]).toBeDefined();
  });
});
