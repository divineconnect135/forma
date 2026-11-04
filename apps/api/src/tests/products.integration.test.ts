import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";

import { app } from "../app.js";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";

let mongoServer: MongoMemoryServer;

const sampleProducts = [
  {
    name: "Desk Lamp",
    slug: "desk-lamp",
    description: "A modern desk lamp",
    category: "lighting",
    priceCents: 3900,
    status: "active",
  },
  {
    name: "Wall Lamp",
    slug: "wall-lamp",
    description: "A decorative wall lamp",
    category: "lighting",
    priceCents: 12900,
    status: "active",
  },
  {
    name: "Floor Light",
    slug: "floor-light",
    description: "A modern floor light",
    category: "lighting",
    priceCents: 21900,
    status: "active",
  },
  {
    name: "Lounge Chair",
    slug: "lounge-chair",
    description: "A comfortable lounge chair",
    category: "furniture",
    priceCents: 34900,
    status: "active",
  },
  {
    name: "Hidden Product",
    slug: "hidden-product",
    description: "An unpublished product",
    category: "accessories",
    priceCents: 5000,
    status: "draft",
  },
];

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  await mongoose.connect(mongoServer.getUri("forma_catalog_test"));

  await Product.init();
  await ProductVariant.init();
}, 120_000);

beforeEach(async () => {
  await ProductVariant.deleteMany({});
  await Product.deleteMany({});

  await Product.insertMany(sampleProducts);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

describe("Product catalog API integration", () => {
  it("returns active products only", async () => {
    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(4);
    expect(response.body.pagination.total).toBe(4);
  });

  it("filters by category", async () => {
    const response = await request(app).get("/api/products?category=furniture");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].slug).toBe("lounge-chair");
  });

  it("filters by a price range", async () => {
    const response = await request(app).get(
      "/api/products?minPriceCents=5000&maxPriceCents=25000",
    );

    expect(response.status).toBe(200);
    expect(response.body.pagination.total).toBe(2);

    const prices = response.body.data.map(
      (product: { priceCents: number }) => product.priceCents,
    );

    expect(prices).toContain(12900);
    expect(prices).toContain(21900);
  });

  it("combines category and price filters", async () => {
    const response = await request(app).get(
      "/api/products?category=lighting&minPriceCents=10000&maxPriceCents=20000",
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].slug).toBe("wall-lamp");
  });

  it("sorts products by ascending price", async () => {
    const response = await request(app).get("/api/products?sort=price-asc");

    expect(response.status).toBe(200);

    const prices = response.body.data.map(
      (product: { priceCents: number }) => product.priceCents,
    );

    expect(prices).toEqual([3900, 12900, 21900, 34900]);
  });

  it("returns correct pagination", async () => {
    const response = await request(app).get(
      "/api/products?page=2&limit=2&sort=price-asc",
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 4,
      pages: 2,
    });

    expect(response.body.data[0].priceCents).toBe(21900);
  });

  it("searches product names", async () => {
    const response = await request(app).get("/api/products?search=lamp");

    expect(response.status).toBe(200);
    expect(response.body.pagination.total).toBe(2);
  });

  it("rejects reversed price ranges", async () => {
    const response = await request(app).get(
      "/api/products?minPriceCents=30000&maxPriceCents=10000",
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_QUERY");
  });

  it("rejects negative prices", async () => {
    const response = await request(app).get("/api/products?minPriceCents=-100");

    expect(response.status).toBe(400);
  });

  it("rejects invalid pagination", async () => {
    const response = await request(app).get("/api/products?page=-2");

    expect(response.status).toBe(400);
  });

  it("returns a product by slug with variants", async () => {
    const product = await Product.findOne({
      slug: "desk-lamp",
    });

    expect(product).not.toBeNull();

    await ProductVariant.create({
      productId: product!._id,
      sku: "DESK-BLACK",
      color: "Black",
      size: null,
      stockOnHand: 8,
      stockReserved: 2,
      active: true,
    });

    const response = await request(app).get("/api/products/desk-lamp");

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe("Desk Lamp");

    expect(response.body.data.variants[0]).toMatchObject({
      sku: "DESK-BLACK",
      color: "Black",
      availableQuantity: 6,
      inStock: true,
    });

    expect(response.body.data.variants[0].stockReserved).toBeUndefined();
  });

  it("does not expose draft products by slug", async () => {
    const response = await request(app).get("/api/products/hidden-product");

    expect(response.status).toBe(404);
  });

  it("returns 404 for missing products", async () => {
    const response = await request(app).get("/api/products/does-not-exist");

    expect(response.status).toBe(404);
  });
});
