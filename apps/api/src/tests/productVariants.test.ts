import { describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../app.js";
import { getAvailableQuantity } from "../services/product.service.js";

describe("Product inventory calculations", () => {
  it("returns available stock", () => {
    expect(getAvailableQuantity(10, 3)).toBe(7);
  });

  it("returns zero when all stock is reserved", () => {
    expect(getAvailableQuantity(5, 5)).toBe(0);
  });

  it("never displays negative available stock", () => {
    expect(getAvailableQuantity(2, 4)).toBe(0);
  });
});

describe("Product details API validation", () => {
  it("rejects invalid product slugs", async () => {
    const response = await request(app).get("/api/products/Invalid%20slug");

    expect(response.status).toBe(400);

    expect(response.body.error.code).toBe("INVALID_SLUG");
  });
});
