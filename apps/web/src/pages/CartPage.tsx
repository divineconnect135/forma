import { useEffect, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Link } from "react-router";

import { useGuestCart } from "../contexts/GuestCartContext";
import { useCurrentUser } from "../hooks/useCurrentUser";

import {
  getServerCart,
  mergeServerCart,
  previewGuestCart,
  removeServerCartItem,
  updateServerCartItem,
  type CartItem,
} from "../lib/cart";

import { formatUsd } from "../lib/money";

export function CartPage() {
  const guestCart = useGuestCart();
  const userQuery = useCurrentUser();
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState("");
  const [mergeError, setMergeError] = useState("");

  const attemptedMerge = useRef("");

  const user = userQuery.data;

  const needsMerge = Boolean(user && guestCart.items.length > 0);

  const mergeMutation = useMutation({
    mutationFn: () => mergeServerCart(guestCart.mergeId, guestCart.items),

    onSuccess: async () => {
      setMergeError("");

      // Only clear local data after server confirmation.
      guestCart.clear();

      await queryClient.invalidateQueries({
        queryKey: ["cart"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["checkout"],
      });
    },

    onError: (error) => {
      setMergeError(
        error instanceof Error ? error.message : "Unable to merge guest cart",
      );
    },
  });

  const { mutate: startMerge } = mergeMutation;

  useEffect(() => {
    if (
      !user ||
      guestCart.items.length === 0 ||
      attemptedMerge.current === guestCart.mergeId
    ) {
      return;
    }

    attemptedMerge.current = guestCart.mergeId;
    startMerge();
  }, [user, guestCart.items.length, guestCart.mergeId, startMerge]);

  const cartQuery = useQuery({
    queryKey: ["cart", user?.id ?? "guest", guestCart.items],

    queryFn: () => (user ? getServerCart() : previewGuestCart(guestCart.items)),

    enabled: !userQuery.isPending && !userQuery.isError && !needsMerge,

    staleTime: 0,
    retry: false,
  });

  async function refreshCart() {
    await queryClient.invalidateQueries({
      queryKey: ["cart"],
    });

    await queryClient.invalidateQueries({
      queryKey: ["checkout"],
    });
  }

  async function changeQuantity(item: CartItem, quantity: number) {
    setActionError("");

    if (quantity < 1 || quantity > 20 || quantity > item.availableQuantity) {
      return;
    }

    try {
      if (user) {
        await updateServerCartItem(item.variantId, quantity);

        await refreshCart();
      } else {
        guestCart.setQuantity(item.variantId, quantity);
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to update quantity",
      );
    }
  }

  async function removeItem(item: CartItem) {
    setActionError("");

    try {
      if (user) {
        await removeServerCartItem(item.variantId);
        await refreshCart();
      } else {
        guestCart.removeItem(item.variantId);
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to remove item",
      );
    }
  }

  if (userQuery.isPending) {
    return (
      <p role="status" className="py-12">
        Checking your session...
      </p>
    );
  }

  if (userQuery.isError) {
    return (
      <div role="alert" className="space-y-3">
        <p>Unable to verify your session.</p>

        <button
          type="button"
          onClick={() => void userQuery.refetch()}
          className="text-orange-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Guest cart merging takes priority over reading
  // the authenticated cart.
  if (needsMerge) {
    return (
      <section className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-4xl font-semibold">Your Shopping Cart</h1>

        {mergeError ? (
          <div
            role="alert"
            className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-6"
          >
            <h2 className="font-semibold text-red-900">Cart merging failed</h2>

            <p className="text-sm text-red-800">{mergeError}</p>

            <p className="text-sm text-neutral-700">
              Your guest cart is still saved. Remove unavailable items or retry.
            </p>

            <div className="space-y-2">
              {guestCart.items.map((item) => (
                <div
                  key={item.variantId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3 text-sm"
                >
                  <span>
                    Variant {item.variantId.slice(-8)}
                    {" · "}
                    Quantity {item.quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => guestCart.removeItem(item.variantId)}
                    className="text-red-700 underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={mergeMutation.isPending}
              onClick={() => {
                setMergeError("");
                startMerge();
              }}
              className="rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              Retry merge
            </button>

            <button
              type="button"
              onClick={guestCart.clear}
              className="ml-3 text-sm text-red-800 underline"
            >
              Discard guest cart
            </button>
          </div>
        ) : (
          <p role="status" className="text-neutral-600">
            Merging your saved guest cart...
          </p>
        )}
      </section>
    );
  }

  if (cartQuery.isPending) {
    return (
      <p role="status" className="py-12">
        Loading your cart...
      </p>
    );
  }

  if (cartQuery.isError) {
    return (
      <div role="alert" className="space-y-3">
        <p>Unable to load the shopping cart.</p>

        <button
          type="button"
          onClick={() => void cartQuery.refetch()}
          className="text-orange-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const cart = cartQuery.data.data;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-4xl font-semibold">Your Shopping Cart</h1>

        <p className="mt-2 text-neutral-600">
          {cart.itemCount} item
          {cart.itemCount === 1 ? "" : "s"}
        </p>
      </header>

      {!user && cart.items.length > 0 && (
        <div className="rounded-xl bg-orange-50 p-5 text-sm text-orange-900">
          Your cart is saved on this browser.{" "}
          <Link to="/login" className="font-semibold underline">
            Sign in
          </Link>{" "}
          to save it to your account.
        </div>
      )}

      {actionError && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {actionError}
        </p>
      )}

      {cart.items.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 p-12 text-center">
          <h2 className="text-2xl font-semibold">Your cart is empty</h2>

          <p className="mt-2 text-neutral-600">
            Explore the Forma collection to add products.
          </p>

          <Link
            to="/products"
            className="mt-6 inline-block rounded-xl bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {cart.items.map((item) => (
              <article
                key={item.variantId}
                className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:flex-row"
              >
                <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#e9e4dd]">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="text-4xl font-bold text-neutral-400"
                    >
                      F.
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  {item.productSlug ? (
                    <Link
                      to={`/products/${item.productSlug}`}
                      className="text-lg font-semibold hover:text-orange-700"
                    >
                      {item.productName}
                    </Link>
                  ) : (
                    <h2 className="text-lg font-semibold">
                      {item.productName}
                    </h2>
                  )}

                  <p className="text-sm text-neutral-600">
                    {[item.color, item.size].filter(Boolean).join(" · ")}
                  </p>

                  <p className="font-medium">
                    {formatUsd(item.unitPriceCents)}
                  </p>

                  {!item.canPurchase && (
                    <p className="text-sm font-medium text-red-700">
                      Unavailable or insufficient stock
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center rounded-lg border border-neutral-300">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.productName} quantity`}
                        disabled={item.quantity <= 1}
                        onClick={() =>
                          void changeQuantity(item, item.quantity - 1)
                        }
                        className="px-3 py-2 disabled:opacity-30"
                      >
                        −
                      </button>

                      <span className="min-w-8 text-center text-sm">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        aria-label={`Increase ${item.productName} quantity`}
                        disabled={
                          item.quantity >= 20 ||
                          item.quantity >= item.availableQuantity ||
                          !item.canPurchase
                        }
                        onClick={() =>
                          void changeQuantity(item, item.quantity + 1)
                        }
                        className="px-3 py-2 disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => void removeItem(item)}
                      className="text-sm font-medium text-red-700 underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="h-fit space-y-5 rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Order Summary</h2>

            <div className="flex justify-between">
              <span className="text-neutral-600">Estimated subtotal</span>

              <span className="font-semibold">
                {formatUsd(cart.subtotalCents)}
              </span>
            </div>

            <p className="text-sm text-neutral-500">
              Shipping and tax are not calculated yet.
            </p>

            {cart.hasUnavailableItems && (
              <p role="alert" className="text-sm text-red-700">
                Some items are unavailable. Review your cart before checkout.
              </p>
            )}

            {user ? (
              cart.hasUnavailableItems ? (
                <div className="rounded-xl bg-neutral-100 p-4 text-sm text-neutral-600">
                  Checkout is unavailable until all items have sufficient stock.
                </div>
              ) : (
                <Link
                  to="/checkout"
                  className="block rounded-xl bg-neutral-900 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-neutral-700"
                >
                  Review Checkout
                </Link>
              )
            ) : (
              <Link
                to="/login"
                className="block rounded-xl bg-neutral-900 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-neutral-700"
              >
                Sign in to Checkout
              </Link>
            )}

            <Link
              to="/products"
              className="block rounded-xl border border-neutral-300 px-5 py-3 text-center text-sm font-medium"
            >
              Continue shopping
            </Link>

            <p className="text-xs leading-5 text-neutral-500">
              Stripe payments will be added in the next step. No payment is
              collected here.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}
