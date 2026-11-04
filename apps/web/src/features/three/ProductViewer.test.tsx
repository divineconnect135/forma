// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ProductViewer } from "./ProductViewer";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ProductViewer", () => {
  it("offers interactive 3D for the Orbit Desk Lamp", () => {
    render(
      <ProductViewer
        productName="Orbit Desk Lamp"
        productSlug="orbit-desk-lamp"
        imageUrl={null}
        modelUrl={null}
        color="Black"
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "View in 3D",
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole("img", {
        name: /Orbit Desk Lamp illustrative preview/i,
      }),
    ).toBeTruthy();
  });

  it("supports the lounge chair demonstration", () => {
    render(
      <ProductViewer
        productName="Arc Lounge Chair"
        productSlug="arc-lounge-chair"
        imageUrl={null}
        modelUrl={null}
        color="Olive"
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "View in 3D",
      }),
    ).toBeTruthy();
  });

  it("supports the desk tray demonstration", () => {
    render(
      <ProductViewer
        productName="Modular Desk Tray"
        productSlug="modular-desk-tray"
        imageUrl={null}
        modelUrl={null}
        color="Sand"
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "View in 3D",
      }),
    ).toBeTruthy();
  });

  it("shows a static fallback for products without 3D models", () => {
    render(
      <ProductViewer
        productName="Stoneware Catchall"
        productSlug="stoneware-catchall"
        imageUrl={null}
        modelUrl={null}
        color="Ivory"
      />,
    );

    expect(
      screen.getByText("3D model not available for this product."),
    ).toBeTruthy();

    expect(
      screen.queryByRole("button", {
        name: "View in 3D",
      }),
    ).toBeNull();
  });

  it("supports products with valid GLB assets", () => {
    render(
      <ProductViewer
        productName="Example Product"
        productSlug="example-product"
        imageUrl={null}
        modelUrl="/models/example-product.glb"
        color="Black"
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "View in 3D",
      }),
    ).toBeTruthy();
  });

  it("keeps the static preview when WebGL is unavailable", () => {
    // Simulate a browser without WebGL support.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    render(
      <ProductViewer
        productName="Orbit Desk Lamp"
        productSlug="orbit-desk-lamp"
        imageUrl={null}
        modelUrl={null}
        color="Black"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "View in 3D",
      }),
    );

    expect(screen.getByRole("alert")).toBeTruthy();

    expect(
      screen.getByRole("img", {
        name: /Orbit Desk Lamp illustrative preview/i,
      }),
    ).toBeTruthy();
  });
});
