import { describe, expect, it } from "vitest";
import { formatUsd } from "./money";

describe("formatUsd", () => {
  it("formats cents without floating-point price storage", () => {
    expect(formatUsd(1299)).toBe("$12.99");
  });
  it("rejects fractional cents", () => {
    expect(() => formatUsd(12.5)).toThrow();
  });
});
