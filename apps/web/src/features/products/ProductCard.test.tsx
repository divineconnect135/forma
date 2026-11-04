// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { cleanup, render, screen } from "@testing-library/react";

import { MemoryRouter } from "react-router";

import { ProductCard } from "./ProductCard";
import type { Product } from "../../lib/products";

const product: Product = {
  _id: "test-product",
  name: "Orbit Desk Lamp",
  slug: "orbit-desk-lamp",
  description: "Modern adjustable desk lamp",
  category: "lighting",
  priceCents: 12900,
  currency: "USD",
  images: [],
  modelUrl: null,
  featured: true,
};

afterEach(() => {
  cleanup();
});

function renderProductCard() {
  return render(
    <MemoryRouter>
      <ProductCard product={product} />
    </MemoryRouter>,
  );
}

describe("ProductCard", () => {
  it("displays product information", () => {
    renderProductCard();

    expect(
      screen.getByRole("heading", {
        name: "Orbit Desk Lamp",
      }),
    ).toBeTruthy();

    expect(screen.getByText("$129.00")).toBeTruthy();

    expect(screen.getByText("Featured")).toBeTruthy();
  });

  it("displays an image fallback", () => {
    renderProductCard();

    expect(screen.getByText("Image coming soon")).toBeTruthy();
  });

  it("links to the product details page", () => {
    renderProductCard();

    const link = screen.getByRole("link", {
      name: /Orbit Desk Lamp/,
    });

    expect(link.getAttribute("href")).toBe("/products/orbit-desk-lamp");
  });
});
