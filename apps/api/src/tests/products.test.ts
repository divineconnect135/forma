import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { listProductsQuerySchema } from "../validators/product.js";

describe("Product query validation", () => {
  it("accepts valid pagination", () => {
    const result = listProductsQuerySchema.safeParse({
      page: "2",
      limit: "12",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(12);
    }
  });

  it("rejects negative page numbers", () => {
    const result = listProductsQuerySchema.safeParse({
      page: "-1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid sorting", () => {
    const result = listProductsQuerySchema.safeParse({
      sort: "invalid",
    });

    expect(result.success).toBe(false);
  });
});

describe("Product API", () => {
  it("rejects invalid pagination with 400", async () => {
    const response = await request(app).get("/api/products?page=-1");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_QUERY");
  });
});
