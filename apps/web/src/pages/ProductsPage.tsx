import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

import { ProductCard } from "../features/products/ProductCard";
import { fetchProducts, type ProductSort } from "../lib/products";

const PAGE_SIZE = 6;
const MAX_PRICE_CENTS = 999_999_999;

// Read a valid integer price from URL parameters.
function readCents(value: string | null): number | undefined {
  if (value === null || !/^(0|[1-9]\d{0,8})$/.test(value)) {
    return undefined;
  }

  return Number(value);
}

function toDollarText(cents?: number): string {
  return cents === undefined ? "" : (cents / 100).toFixed(2);
}

// Convert user-entered dollars to integer cents.
function parseDollars(input: string): number | undefined | null {
  const text = input.trim();

  if (text === "") {
    return undefined;
  }

  if (!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) {
    return null;
  }

  const [dollars, fraction = ""] = text.split(".");

  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents) || cents > MAX_PRICE_CENTS) {
    return null;
  }

  return cents;
}

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";

  const sortParam = searchParams.get("sort");

  const sort: ProductSort =
    sortParam === "price-asc" || sortParam === "price-desc"
      ? sortParam
      : "newest";

  const pageParam = Number(searchParams.get("page") ?? "1");

  const page =
    Number.isSafeInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

  const minPriceCents = readCents(searchParams.get("minPriceCents"));

  const maxPriceCents = readCents(searchParams.get("maxPriceCents"));

  // Form state is separate from applied URL filters.
  const [searchText, setSearchText] = useState(search);
  const [minPriceText, setMinPriceText] = useState(toDollarText(minPriceCents));
  const [maxPriceText, setMaxPriceText] = useState(toDollarText(maxPriceCents));
  const [priceError, setPriceError] = useState("");

  // Keep inputs synchronized with browser back/forward.
  useEffect(() => {
    setSearchText(search);
    setMinPriceText(toDollarText(minPriceCents));
    setMaxPriceText(toDollarText(maxPriceCents));
    setPriceError("");
  }, [search, minPriceCents, maxPriceCents]);

  function updateParams(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(changes)) {
      if (value !== "") {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }

    // Start from page one when applied filters change.
    if (!("page" in changes)) {
      next.delete("page");
    }

    setSearchParams(next);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const minimum = parseDollars(minPriceText);
    const maximum = parseDollars(maxPriceText);

    if (minimum === null || maximum === null) {
      setPriceError(
        "Enter valid dollar amounts with up to two decimal places.",
      );
      return;
    }

    if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
      setPriceError("Minimum price cannot exceed maximum price.");
      return;
    }

    setPriceError("");

    updateParams({
      search: searchText.trim(),
      minPriceCents: minimum === undefined ? "" : String(minimum),
      maxPriceCents: maximum === undefined ? "" : String(maximum),
    });
  }

  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: [
      "products",
      {
        page,
        search,
        category,
        sort,
        minPriceCents,
        maxPriceCents,
      },
    ],

    queryFn: ({ signal }) =>
      fetchProducts(
        {
          page,
          limit: PAGE_SIZE,
          search,
          category,
          sort,
          minPriceCents,
          maxPriceCents,
        },
        signal,
      ),

    staleTime: 30_000,
    retry: 1,
  });

  return (
    <section className="space-y-8">
      {/* Heading */}
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">
          Explore Forma
        </p>

        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          The Collection
        </h1>

        <p className="mt-3 max-w-2xl text-neutral-600">
          Thoughtfully designed essentials for home and work.
        </p>
      </header>

      {/* Filters */}
      <div className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
        <form onSubmit={applyFilters} role="search" className="space-y-4">
          <div>
            <label
              htmlFor="product-search"
              className="mb-2 block text-sm font-medium"
            >
              Search products
            </label>

            <input
              id="product-search"
              type="search"
              value={searchText}
              maxLength={80}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search lamps, chairs, accessories..."
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
            />
          </div>

          {/* Price inputs */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="minimum-price"
                className="mb-2 block text-sm font-medium"
              >
                Minimum price (USD)
              </label>

              <input
                id="minimum-price"
                type="text"
                inputMode="decimal"
                value={minPriceText}
                onChange={(event) => {
                  setMinPriceText(event.target.value);
                  setPriceError("");
                }}
                placeholder="e.g. 50.00"
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
              />
            </div>

            <div>
              <label
                htmlFor="maximum-price"
                className="mb-2 block text-sm font-medium"
              >
                Maximum price (USD)
              </label>

              <input
                id="maximum-price"
                type="text"
                inputMode="decimal"
                value={maxPriceText}
                onChange={(event) => {
                  setMaxPriceText(event.target.value);
                  setPriceError("");
                }}
                placeholder="e.g. 200.00"
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
              />
            </div>
          </div>

          {priceError && (
            <p role="alert" className="text-sm text-red-700">
              {priceError}
            </p>
          )}

          <button
            type="submit"
            className="rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-700"
          >
            Apply filters
          </button>
        </form>

        <div className="flex flex-wrap items-end gap-4 border-t border-neutral-200 pt-5">
          {/* Category */}
          <label className="flex min-w-40 flex-1 flex-col gap-2 text-sm font-medium">
            Category
            <select
              value={category}
              onChange={(event) =>
                updateParams({
                  category: event.target.value,
                })
              }
              className="rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm"
            >
              <option value="">All categories</option>
              <option value="lighting">Lighting</option>
              <option value="furniture">Furniture</option>
              <option value="accessories">Accessories</option>
            </select>
          </label>

          {/* Sorting */}
          <label className="flex min-w-40 flex-1 flex-col gap-2 text-sm font-medium">
            Sort by
            <select
              value={sort}
              onChange={(event) =>
                updateParams({
                  sort: event.target.value,
                })
              }
              className="rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm"
            >
              <option value="newest">Newest</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setSearchText("");
              setMinPriceText("");
              setMaxPriceText("");
              setPriceError("");
              setSearchParams(new URLSearchParams());
            }}
            className="rounded-xl border border-neutral-300 px-5 py-3 text-sm hover:bg-neutral-100"
          >
            Clear filters
          </button>
        </div>
      </div>

      {/* Initial loading */}
      {isPending ? (
        <div
          role="status"
          aria-label="Loading products"
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: PAGE_SIZE }, (_, index) => (
            <div
              key={index}
              className="animate-pulse overflow-hidden rounded-2xl border border-neutral-200"
            >
              <div className="aspect-[4/3] bg-neutral-200" />
              <div className="space-y-3 p-5">
                <div className="h-5 w-1/3 rounded bg-neutral-200" />
                <div className="h-6 w-2/3 rounded bg-neutral-200" />
                <div className="h-4 w-full rounded bg-neutral-200" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6"
        >
          <h2 className="font-semibold text-red-900">
            Unable to load products
          </h2>

          <p className="mt-2 text-sm text-red-800">
            Check the API and MongoDB connection.
          </p>

          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 rounded-lg bg-red-900 px-4 py-2 text-sm text-white"
          >
            Try again
          </button>
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-neutral-600">
              {data.pagination.total} product
              {data.pagination.total === 1 ? "" : "s"} found
            </p>

            {isFetching && (
              <span className="text-sm text-neutral-500">Updating...</span>
            )}
          </div>

          {/* Empty state */}
          {data.data.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center">
              <h2 className="text-xl font-semibold">No products found</h2>

              <p className="mt-2 text-neutral-600">
                Try changing your search or price range.
              </p>

              {page > 1 && data.pagination.total > 0 && (
                <button
                  type="button"
                  onClick={() => updateParams({ page: "1" })}
                  className="mt-4 text-sm font-medium text-orange-700 underline"
                >
                  Return to page 1
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.data.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data.pagination.pages > 1 && (
            <nav
              aria-label="Product pagination"
              className="flex items-center justify-center gap-4"
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() =>
                  updateParams({
                    page: String(page - 1),
                  })
                }
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>

              <span className="text-sm text-neutral-600">
                Page {page} of {data.pagination.pages}
              </span>

              <button
                type="button"
                disabled={page >= data.pagination.pages}
                onClick={() =>
                  updateParams({
                    page: String(page + 1),
                  })
                }
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </div>
      ) : null}
    </section>
  );
}
