// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { cleanup, render, waitFor } from "@testing-library/react";

import { MemoryRouter } from "react-router";

import { PageSeo } from "./PageSeo";

afterEach(() => {
  cleanup();

  document.head.querySelector('link[rel="canonical"]')?.remove();

  document.head.querySelector('meta[property="og:url"]')?.remove();
});

function renderSeo(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PageSeo />
    </MemoryRouter>,
  );
}

describe("PageSeo", () => {
  it("updates the document title", async () => {
    renderSeo("/products");

    await waitFor(() => {
      expect(document.title).toBe("Shop Furniture and Lighting | Forma");
    });
  });

  it("sets the canonical URL on public pages", async () => {
    renderSeo("/products");

    await waitFor(() => {
      const canonical = document.head.querySelector<HTMLLinkElement>(
        'link[rel="canonical"]',
      );

      expect(canonical?.href).toBe(
        new URL("/products", window.location.origin).toString(),
      );
    });
  });

  it("marks admin routes as noindex", async () => {
    renderSeo("/admin/products");

    await waitFor(() => {
      const robots = document.head.querySelector<HTMLMetaElement>(
        'meta[name="robots"]',
      );

      expect(robots?.content).toBe("noindex, nofollow");
    });

    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it("updates the meta description", async () => {
    renderSeo("/products");

    await waitFor(() => {
      const description = document.head.querySelector<HTMLMetaElement>(
        'meta[name="description"]',
      );

      expect(description?.content).toContain("Browse furniture");
    });
  });
});
