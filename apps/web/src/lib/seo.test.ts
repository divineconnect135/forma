import { describe, expect, it } from "vitest";

import { getPageSeo } from "./seo";

describe("Forma SEO configuration", () => {
  it("provides home page metadata", () => {
    const seo = getPageSeo("/");

    expect(seo.indexable).toBe(true);

    expect(seo.title).toContain("Forma");

    expect(seo.canonicalPath).toBe("/");
  });

  it("provides catalog metadata", () => {
    const seo = getPageSeo("/products");

    expect(seo.indexable).toBe(true);

    expect(seo.canonicalPath).toBe("/products");

    expect(seo.description.length).toBeGreaterThan(20);
  });

  it("supports public product URLs", () => {
    const seo = getPageSeo("/products/orbit-desk-lamp");

    expect(seo.indexable).toBe(true);

    expect(seo.canonicalPath).toBe("/products/orbit-desk-lamp");
  });

  it("does not index administrator routes", () => {
    const paths = [
      "/admin",
      "/admin/products",
      "/admin/orders",
      "/admin/customers",
      "/admin/audit",
    ];

    for (const path of paths) {
      const seo = getPageSeo(path);

      expect(seo.indexable).toBe(false);

      expect(seo.canonicalPath).toBeNull();
    }
  });

  it("does not index customer account routes", () => {
    const paths = [
      "/account",
      "/cart",
      "/checkout",
      "/checkout/success",
      "/checkout/cancel",
      "/orders",
      "/orders/507f1f77bcf86cd799439011",
    ];

    for (const path of paths) {
      expect(getPageSeo(path).indexable).toBe(false);
    }
  });

  it("does not index login or registration", () => {
    expect(getPageSeo("/login").indexable).toBe(false);

    expect(getPageSeo("/register").indexable).toBe(false);
  });

  it("normalizes trailing slashes", () => {
    const withoutSlash = getPageSeo("/products");

    const withSlash = getPageSeo("/products/");

    expect(withSlash).toEqual(withoutSlash);
  });

  it("does not index unknown URLs", () => {
    const seo = getPageSeo("/this-page-does-not-exist");

    expect(seo.indexable).toBe(false);

    expect(seo.title).toContain("Not Found");

    expect(seo.canonicalPath).toBeNull();
  });
});
