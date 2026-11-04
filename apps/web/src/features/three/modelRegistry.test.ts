import { describe, expect, it } from "vitest";

import {
  getDemoModelKind,
  getSafeModelUrl,
  getVariantColor,
  supports3D,
} from "./modelRegistry";

describe("3D model registry", () => {
  it("recognizes the three demonstration products", () => {
    expect(getDemoModelKind("orbit-desk-lamp")).toBe("lamp");

    expect(getDemoModelKind("arc-lounge-chair")).toBe("chair");

    expect(getDemoModelKind("modular-desk-tray")).toBe("tray");
  });

  it("returns null for other products", () => {
    expect(getDemoModelKind("unknown-product")).toBeNull();
  });

  it("accepts a valid local GLB path", () => {
    expect(getSafeModelUrl("/models/modern-chair.glb")).toBe(
      "/models/modern-chair.glb",
    );
  });

  it("rejects external model URLs", () => {
    expect(getSafeModelUrl("https://example.com/model.glb")).toBeNull();
  });

  it("rejects directory traversal", () => {
    expect(getSafeModelUrl("/models/../../private.glb")).toBeNull();
  });

  it("supports a product with an imported GLB", () => {
    expect(supports3D("another-product", "/models/another-product.glb")).toBe(
      true,
    );
  });

  it("does not offer 3D for missing models", () => {
    expect(supports3D("another-product", null)).toBe(false);
  });

  it("maps known color variants", () => {
    expect(getVariantColor("Black")).toBe("#343434");
    expect(getVariantColor("Brass")).toBe("#bd9256");
  });
});
