import { useState } from "react";

import { Link, useNavigate, useParams } from "react-router";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ProductViewer } from "../features/three/ProductViewer";

import { useCurrentUser } from "../hooks/useCurrentUser";
import { useGuestCart } from "../contexts/GuestCartContext";

import { addServerCartItem } from "../lib/cart";
import { formatUsd } from "../lib/money";

import {
  fetchProductBySlug,
  ProductNotFoundError,
  type ProductDetail,
} from "../lib/products";

interface ProductContentProps {
  product: ProductDetail;
}

function ProductContent({ product }: ProductContentProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const guestCart = useGuestCart();
  const currentUser = useCurrentUser();

  const firstAvailableVariant = product.variants.find(
    (variant) => variant.inStock,
  );

  const [selectedVariantId, setSelectedVariantId] = useState(
    firstAvailableVariant?._id ?? "",
  );

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const selectedVariant = product.variants.find(
    (variant) => variant._id === selectedVariantId,
  );

  const availableQuantity = selectedVariant?.availableQuantity ?? 0;

  const maximumQuantity = Math.min(availableQuantity, 20);

  function selectVariant(variantId: string) {
    setSelectedVariantId(variantId);
    setQuantity(1);
    setAddError("");
  }

  function increaseQuantity() {
    setQuantity((current) => Math.min(current + 1, maximumQuantity));
  }

  function decreaseQuantity() {
    setQuantity((current) => Math.max(1, current - 1));
  }

  async function handleAddToCart() {
    if (
      !selectedVariant ||
      !selectedVariant.inStock ||
      quantity < 1 ||
      quantity > maximumQuantity
    ) {
      return;
    }

    setAdding(true);
    setAddError("");

    try {
      if (currentUser.isPending || currentUser.isError) {
        throw new Error("Unable to verify your session. Please try again.");
      }

      if (currentUser.data) {
        // Save the cart through Express and MongoDB.
        await addServerCartItem(selectedVariant._id, quantity);
      } else {
        // Temporary guest cart.
        const existing = guestCart.items.find(
          (item) => item.variantId === selectedVariant._id,
        );

        const combined = (existing?.quantity ?? 0) + quantity;

        if (combined > maximumQuantity || combined > 20) {
          throw new Error(
            "Requested quantity exceeds available stock or the cart limit.",
          );
        }

        if (!existing && guestCart.items.length >= 30) {
          throw new Error("Your cart already contains 30 variants.");
        }

        guestCart.addItem(selectedVariant._id, quantity);
      }

      await queryClient.invalidateQueries({
        queryKey: ["cart"],
      });

      navigate("/cart");
    } catch (error) {
      setAddError(
        error instanceof Error ? error.message : "Unable to add this item",
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="space-y-10">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap gap-2 text-sm text-neutral-500"
      >
        <Link to="/" className="hover:text-neutral-900">
          Home
        </Link>

        <span aria-hidden="true">/</span>

        <Link to="/products" className="hover:text-neutral-900">
          Products
        </Link>

        <span aria-hidden="true">/</span>

        <span aria-current="page" className="text-neutral-900">
          {product.name}
        </span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Interactive 3D viewer */}
        <ProductViewer
          key={product._id}
          productName={product.name}
          productSlug={product.slug}
          imageUrl={product.images[0] ?? null}
          modelUrl={product.modelUrl}
          color={selectedVariant?.color ?? "Black"}
        />

        {/* Product information */}
        <div className="space-y-7">
          <header>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">
              {product.category}
            </p>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
              {product.name}
            </h1>

            <p className="mt-4 text-3xl font-semibold">
              {formatUsd(product.priceCents)}
            </p>
          </header>

          <p className="leading-7 text-neutral-600">{product.description}</p>

          {/* Variant selector */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">
              Select color and size
            </legend>

            {product.variants.length === 0 ? (
              <p className="text-sm text-red-700">
                No variants are currently available.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {product.variants.map((variant) => {
                  const selected = variant._id === selectedVariantId;

                  return (
                    <button
                      key={variant._id}
                      type="button"
                      aria-pressed={selected}
                      disabled={!variant.inStock}
                      onClick={() => selectVariant(variant._id)}
                      className={`rounded-xl border px-5 py-3 text-left text-sm transition ${
                        selected
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-300 bg-white hover:border-neutral-700"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <span className="block font-medium">{variant.color}</span>

                      {variant.size && (
                        <span className="mt-1 block text-xs">
                          {variant.size}
                        </span>
                      )}

                      {!variant.inStock && (
                        <span className="mt-1 block text-xs">Out of stock</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>

          {/* Availability */}
          <div aria-live="polite">
            {selectedVariant ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-green-800">
                  In stock — {availableQuantity} available
                </p>

                <p className="text-xs text-neutral-500">
                  SKU: {selectedVariant.sku}
                </p>
              </div>
            ) : (
              <p className="text-sm font-medium text-red-700">
                Currently unavailable
              </p>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Quantity</p>

            <div className="flex w-fit items-center overflow-hidden rounded-xl border border-neutral-300">
              <button
                type="button"
                onClick={decreaseQuantity}
                disabled={!selectedVariant || quantity <= 1}
                aria-label="Decrease quantity"
                className="px-5 py-3 text-lg disabled:opacity-30"
              >
                −
              </button>

              <output
                aria-live="polite"
                className="min-w-10 text-center font-medium"
              >
                {quantity}
              </output>

              <button
                type="button"
                onClick={increaseQuantity}
                disabled={!selectedVariant || quantity >= maximumQuantity}
                aria-label="Increase quantity"
                className="px-5 py-3 text-lg disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>

          {/* Subtotal */}
          <div className="flex items-center justify-between border-t border-neutral-200 pt-5">
            <span className="text-sm text-neutral-600">Estimated subtotal</span>

            <span className="text-xl font-semibold">
              {formatUsd(product.priceCents * quantity)}
            </span>
          </div>

          {addError && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
            >
              {addError}
            </p>
          )}

          {/* Add to cart */}
          <button
            type="button"
            disabled={
              adding ||
              currentUser.isPending ||
              currentUser.isError ||
              !selectedVariant ||
              !selectedVariant.inStock
            }
            onClick={() => void handleAddToCart()}
            className="w-full rounded-xl bg-neutral-900 px-6 py-4 font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {adding ? "Adding..." : "Add to Cart"}
          </button>

          <p className="text-xs leading-5 text-neutral-500">
            Interactive 3D previews are illustrative. Colors and proportions may
            differ from physical products.
          </p>

          <Link
            to="/products"
            className="inline-block text-sm font-medium text-orange-700 underline underline-offset-4"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </section>
  );
}

export function ProductDetailsPage() {
  const { slug } = useParams<"slug">();

  const {
    data: product,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["product", slug],

    queryFn: ({ signal }) => {
      if (!slug) {
        throw new ProductNotFoundError();
      }

      return fetchProductBySlug(slug, signal);
    },

    enabled: Boolean(slug),
    staleTime: 30_000,
    retry: false,
  });

  if (!slug || error instanceof ProductNotFoundError) {
    return (
      <section className="py-20 text-center">
        <h1 className="text-3xl font-semibold">Product not found</h1>

        <p className="mt-3 text-neutral-600">
          This product may have been removed or archived.
        </p>

        <Link
          to="/products"
          className="mt-5 inline-block text-orange-700 underline"
        >
          Back to products
        </Link>
      </section>
    );
  }

  if (isPending) {
    return (
      <div role="status" className="grid animate-pulse gap-10 lg:grid-cols-2">
        <div className="aspect-square rounded-3xl bg-neutral-200" />

        <div className="space-y-5">
          <div className="h-6 w-1/3 rounded bg-neutral-200" />
          <div className="h-12 w-3/4 rounded bg-neutral-200" />
          <div className="h-8 w-1/3 rounded bg-neutral-200" />
          <div className="h-24 rounded bg-neutral-200" />
        </div>

        <span className="sr-only">Loading product details</span>
      </div>
    );
  }

  if (isError) {
    return (
      <section role="alert" className="space-y-4 py-12">
        <h1 className="text-2xl font-semibold">Unable to load product</h1>

        <p className="text-neutral-600">
          Please check your connection and try again.
        </p>

        <button
          type="button"
          onClick={() => void refetch()}
          className="text-orange-700 underline"
        >
          Try again
        </button>
      </section>
    );
  }

  if (!product) return null;

  return <ProductContent key={product._id} product={product} />;
}
