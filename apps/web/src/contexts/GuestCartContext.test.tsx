// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { GuestCartProvider, useGuestCart } from "./GuestCartContext";

const VARIANT_ID = "507f1f77bcf86cd799439011";

function TestCartControls() {
  const cart = useGuestCart();

  return (
    <div>
      <output data-testid="count">
        {cart.items.reduce((sum, item) => sum + item.quantity, 0)}
      </output>

      <button type="button" onClick={() => cart.addItem(VARIANT_ID, 2)}>
        Add
      </button>

      <button type="button" onClick={() => cart.removeItem(VARIANT_ID)}>
        Remove
      </button>

      <button type="button" onClick={cart.clear}>
        Clear
      </button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();

  vi.stubGlobal("crypto", {
    randomUUID: () => "123e4567-e89b-42d3-a456-426614174000",
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Guest cart", () => {
  it("adds a variant and saves it locally", () => {
    render(
      <GuestCartProvider>
        <TestCartControls />
      </GuestCartProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add",
      }),
    );

    expect(screen.getByTestId("count").textContent).toBe("2");

    const stored = JSON.parse(
      localStorage.getItem("forma.guest-cart.v1") ?? "{}",
    );

    expect(stored.items).toEqual([
      {
        variantId: VARIANT_ID,
        quantity: 2,
      },
    ]);

    expect(stored.priceCents).toBeUndefined();
    expect(stored.userId).toBeUndefined();
  });

  it("removes a variant", () => {
    render(
      <GuestCartProvider>
        <TestCartControls />
      </GuestCartProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove",
      }),
    );

    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("clears the guest cart", () => {
    render(
      <GuestCartProvider>
        <TestCartControls />
      </GuestCartProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Clear",
      }),
    );

    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});
