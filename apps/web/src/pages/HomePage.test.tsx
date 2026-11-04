// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanup, render, screen } from "@testing-library/react";

import { MemoryRouter } from "react-router";

import { HomePage } from "./HomePage";

// GSAP animations are tested separately in a browser.
// These tests verify homepage rendering and navigation.
vi.mock("../hooks/useHomeAnimations", () => ({
  useHomeAnimations: () => undefined,
}));

afterEach(() => {
  cleanup();
});

function renderHomePage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe("Forma homepage", () => {
  it("renders the hero and collection link", () => {
    renderHomePage();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Objects worth exploring/i,
      }),
    ).toBeTruthy();

    const collectionLink = screen.getByRole("link", {
      name: "Explore collection",
    });

    expect(collectionLink.getAttribute("href")).toBe("/products");
  });

  it("displays the featured collection", () => {
    renderHomePage();

    expect(
      screen.getByRole("heading", {
        name: "The featured collection",
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole("heading", {
        name: "Orbit Desk Lamp",
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole("heading", {
        name: "Arc Lounge Chair",
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole("heading", {
        name: "Modular Desk Tray",
      }),
    ).toBeTruthy();
  });

  it("provides correct category navigation", () => {
    renderHomePage();

    // Find links using their destinations so the test
    // does not confuse categories with product cards.
    const links = screen.getAllByRole("link");

    const lightingLink = links.find(
      (link) => link.getAttribute("href") === "/products?category=lighting",
    );

    const furnitureLink = links.find(
      (link) => link.getAttribute("href") === "/products?category=furniture",
    );

    const accessoriesLink = links.find(
      (link) => link.getAttribute("href") === "/products?category=accessories",
    );

    expect(lightingLink).toBeDefined();
    expect(furnitureLink).toBeDefined();
    expect(accessoriesLink).toBeDefined();

    expect(lightingLink?.textContent).toContain("Lighting");

    expect(furnitureLink?.textContent).toContain("Furniture");

    expect(accessoriesLink?.textContent).toContain("Accessories");
  });
});
