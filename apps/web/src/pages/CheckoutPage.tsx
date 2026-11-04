import { useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";

import { Link } from "react-router";

import { useCurrentUser } from "../hooks/useCurrentUser";

import { ApiError } from "../lib/http";
import { createCheckoutSession, getCheckoutPreview } from "../lib/checkout";

import { formatUsd } from "../lib/money";

export function CheckoutPage() {
  const currentUser = useCurrentUser();
  const user = currentUser.data;

  // Keep the same key across failed requests
  // and retries while this page stays mounted.
  const [checkoutKey] = useState(() => crypto.randomUUID());

  const {
    data: preview,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["checkout", "preview", user?.id],
    queryFn: getCheckoutPreview,
    enabled: Boolean(user?.id),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
  });

  const checkoutMutation = useMutation({
    mutationFn: () => createCheckoutSession(checkoutKey),

    onSuccess: (result) => {
      const checkoutUrl = new URL(result.data.checkoutUrl);

      // The backend supplies the URL. Validate
      // its destination before redirecting.
      if (
        checkoutUrl.protocol !== "https:" ||
        checkoutUrl.hostname !== "checkout.stripe.com"
      ) {
        throw new Error("Invalid Stripe checkout destination.");
      }

      window.location.assign(checkoutUrl.href);
    },
  });

  if (currentUser.isPending) {
    return (
      <p role="status" className="py-16 text-center">
        Checking your session...
      </p>
    );
  }

  if (currentUser.isError) {
    return (
      <section role="alert" className="space-y-4 py-12">
        <h1 className="text-2xl font-semibold">
          Unable to verify your session
        </h1>

        <button
          type="button"
          onClick={() => void currentUser.refetch()}
          className="text-orange-700 underline"
        >
          Try again
        </button>
      </section>
    );
  }

  if (isPending) {
    return (
      <p role="status" className="py-16 text-center">
        Preparing checkout summary...
      </p>
    );
  }

  if (isError) {
    const cartProblem =
      error instanceof ApiError &&
      ["EMPTY_CART", "CART_ITEMS_UNAVAILABLE"].includes(error.code);

    return (
      <section className="mx-auto max-w-3xl space-y-6 py-12">
        <h1 className="text-3xl font-semibold">Checkout unavailable</h1>

        <p role="alert" className="text-neutral-600">
          {error instanceof Error ? error.message : "Unable to load checkout."}
        </p>

        <div className="flex flex-wrap gap-4">
          <Link
            to="/cart"
            className="rounded-xl bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
          >
            {cartProblem ? "Review your cart" : "Back to cart"}
          </Link>

          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-xl border border-neutral-300 px-6 py-3 text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (!preview) {
    return null;
  }

  const checkout = preview.data;

  return (
    <section className="space-y-9">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
          Forma Test Checkout
        </p>

        <h1 className="text-4xl font-semibold tracking-tight">
          Review Your Order
        </h1>

        <p className="text-neutral-600">
          Review the latest product prices and quantities before opening Stripe
          Checkout.
        </p>

        {isFetching && (
          <p role="status" className="text-sm text-neutral-500">
            Refreshing prices and stock...
          </p>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_330px]">
        {/* Order items */}
        <div className="space-y-5">
          <h2 className="text-xl font-semibold">Order items</h2>

          {checkout.items.map((item) => (
            <article
              key={item.variantId}
              className="flex gap-5 rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#e9e4dd]">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.productName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="text-3xl font-bold text-neutral-400"
                  >
                    F.
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <h3 className="font-semibold">{item.productName}</h3>

                <p className="text-sm text-neutral-600">
                  {[item.color, item.size].filter(Boolean).join(" · ")}
                </p>

                <p className="text-sm text-neutral-600">
                  Quantity: {item.quantity}
                </p>

                <p className="font-semibold">
                  {formatUsd(item.unitPriceCents * item.quantity)}
                </p>
              </div>
            </article>
          ))}
        </div>

        {/* Checkout summary */}
        <aside className="h-fit space-y-6 rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Order Summary</h2>

          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Items</span>
            <span>{checkout.itemCount}</span>
          </div>

          <div className="flex justify-between border-t border-neutral-200 pt-4">
            <span className="text-neutral-600">Subtotal</span>

            <span className="font-semibold">
              {formatUsd(checkout.subtotalCents)}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span>Shipping (test)</span>
            <span>$0.00</span>
          </div>

          <div className="flex justify-between text-sm">
            <span>Tax (test)</span>
            <span>$0.00</span>
          </div>

          <div className="border-t border-neutral-200 pt-4">
            <p className="text-xs leading-5 text-neutral-600">
              This development checkout uses zero shipping and zero tax. The
              payment amount is recalculated from MongoDB before the Stripe
              Session is created.
            </p>
          </div>

          {checkoutMutation.isError && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
            >
              {checkoutMutation.error instanceof Error
                ? checkoutMutation.error.message
                : "Unable to start checkout."}
            </p>
          )}

          <button
            type="button"
            disabled={checkoutMutation.isPending || isFetching}
            onClick={() => checkoutMutation.mutate()}
            className="w-full rounded-xl bg-neutral-900 px-5 py-4 text-sm font-semibold text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkoutMutation.isPending
              ? "Opening Stripe..."
              : "Pay with Stripe (Test Mode)"}
          </button>

          <p className="text-xs leading-5 text-neutral-500">
            Only Stripe test payment details can be used. This does not create a
            real charge.
          </p>

          <Link
            to="/cart"
            className="block rounded-xl border border-neutral-300 px-5 py-3 text-center text-sm font-medium hover:bg-neutral-50"
          >
            Return to cart
          </Link>
        </aside>
      </div>
    </section>
  );
}
