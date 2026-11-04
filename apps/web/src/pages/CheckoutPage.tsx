import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Link, useNavigate } from "react-router";

import { useCurrentUser } from "../hooks/useCurrentUser";

import {
  createCheckoutSession,
  getActiveCheckout,
  getCheckoutPreview,
  resumeCheckoutSession,
  type CheckoutSessionResponse,
} from "../lib/checkout";

import { formatUsd } from "../lib/money";

function isStripeUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname === "checkout.stripe.com";
  } catch {
    return false;
  }
}

export function CheckoutPage() {
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const user = currentUser.data;

  const [checkoutKey] = useState(() => crypto.randomUUID());

  const [actionMessage, setActionMessage] = useState("");

  const activeQuery = useQuery({
    queryKey: ["checkout", "active", user?.id],
    queryFn: getActiveCheckout,
    enabled: Boolean(user),
    retry: false,
    staleTime: 0,
  });

  const hasActiveCheckout = Boolean(activeQuery.data?.data);

  const previewQuery = useQuery({
    queryKey: ["checkout", "preview", user?.id],
    queryFn: getCheckoutPreview,
    enabled: Boolean(user) && activeQuery.isSuccess && !hasActiveCheckout,
    retry: false,
    staleTime: 0,
  });

  function processCheckoutResult(response: CheckoutSessionResponse) {
    const checkout = response.data;

    if (
      checkout.state === "ready" &&
      checkout.checkoutUrl &&
      isStripeUrl(checkout.checkoutUrl)
    ) {
      window.location.assign(checkout.checkoutUrl);
      return;
    }

    if (checkout.state === "paid" || checkout.state === "expired") {
      void queryClient.invalidateQueries({
        queryKey: ["checkout"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["cart"],
      });

      void queryClient.invalidateQueries({
        queryKey: ["orders"],
      });

      navigate(`/orders/${checkout.orderId}`);
      return;
    }

    if (checkout.state === "pending") {
      setActionMessage(
        "Stripe has not confirmed the payment yet. Review the order from My Orders.",
      );
      return;
    }

    setActionMessage(
      "Unable to open the checkout session. Please review the order before trying again.",
    );
  }

  const createMutation = useMutation({
    mutationFn: () => createCheckoutSession(checkoutKey),
    onSuccess: processCheckoutResult,
  });

  const resumeMutation = useMutation({
    mutationFn: resumeCheckoutSession,
    onSuccess: processCheckoutResult,
  });

  const isSubmitting = createMutation.isPending || resumeMutation.isPending;

  if (currentUser.isPending || (user && activeQuery.isPending)) {
    return (
      <p role="status" className="py-16 text-center">
        Checking your checkout...
      </p>
    );
  }

  if (currentUser.isError || activeQuery.isError) {
    return (
      <section role="alert" className="space-y-4 py-12">
        <h1 className="text-2xl font-semibold">Checkout unavailable</h1>

        <p>Unable to verify the current checkout state.</p>

        <button
          type="button"
          onClick={() => {
            if (currentUser.isError) {
              void currentUser.refetch();
            } else {
              void activeQuery.refetch();
            }
          }}
          className="text-orange-700 underline"
        >
          Try again
        </button>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="space-y-4 py-12">
        <h1 className="text-2xl font-semibold">Sign in to checkout</h1>

        <Link to="/login" className="text-orange-700 underline">
          Sign in
        </Link>
      </section>
    );
  }

  const active = activeQuery.data?.data;

  const requestError = createMutation.error ?? resumeMutation.error;

  // The active order takes priority over preview.
  // Do not offer a second checkout while the first
  // order has reserved inventory.
  if (active) {
    return (
      <section className="mx-auto max-w-3xl space-y-7 py-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-700">
          Forma Checkout
        </p>

        <h1 className="text-4xl font-semibold">You have an active checkout</h1>

        <p className="text-neutral-600">
          Your order already exists and its inventory is reserved. You can
          resume the same Stripe Checkout Session without creating a new order.
        </p>

        <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="text-sm text-neutral-500">Order number</p>

          <p className="text-xl font-semibold">{active.orderNumber}</p>

          {active.expiresAt && (
            <p className="text-sm text-neutral-600">
              Reservation deadline:{" "}
              {new Date(active.expiresAt).toLocaleString()}
            </p>
          )}
        </div>

        {requestError && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
          >
            {requestError.message}
          </p>
        )}

        {actionMessage && (
          <p role="status" className="text-sm text-neutral-700">
            {actionMessage}
          </p>
        )}

        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setActionMessage("");
              resumeMutation.mutate();
            }}
            className="rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {resumeMutation.isPending
              ? "Checking Stripe..."
              : "Continue Existing Checkout"}
          </button>

          <Link
            to={`/orders/${active.orderId}`}
            className="rounded-xl border border-neutral-300 px-6 py-3 text-sm font-medium"
          >
            View Order
          </Link>

          <button
            type="button"
            onClick={() => void activeQuery.refetch()}
            className="rounded-xl border border-neutral-300 px-6 py-3 text-sm font-medium"
          >
            Refresh Status
          </button>
        </div>

        <p className="text-sm text-neutral-500">
          If the session cannot be recovered, do not place another payment for
          the same order. Review its status in My Orders.
        </p>
      </section>
    );
  }

  if (previewQuery.isPending) {
    return (
      <p role="status" className="py-16 text-center">
        Preparing checkout summary...
      </p>
    );
  }

  if (previewQuery.isError || !previewQuery.data) {
    return (
      <section className="space-y-5 py-12">
        <h1 className="text-3xl font-semibold">Checkout unavailable</h1>

        <p role="alert">
          {previewQuery.error instanceof Error
            ? previewQuery.error.message
            : "Unable to load checkout."}
        </p>

        <Link to="/cart" className="text-orange-700 underline">
          Review your cart
        </Link>
      </section>
    );
  }

  const checkout = previewQuery.data.data;

  return (
    <section className="space-y-9">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-700">
          Forma Test Checkout
        </p>

        <h1 className="mt-3 text-4xl font-semibold">Review Your Order</h1>

        <p className="mt-3 text-neutral-600">
          Verify the products and quantities before proceeding to Stripe.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_330px]">
        <div className="space-y-4">
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

              <div className="flex-1">
                <h2 className="font-semibold">{item.productName}</h2>

                <p className="mt-2 text-sm text-neutral-600">
                  {[item.color, item.size].filter(Boolean).join(" · ")}
                </p>

                <p className="mt-1 text-sm text-neutral-600">
                  Quantity: {item.quantity}
                </p>

                <p className="mt-2 font-semibold">
                  {formatUsd(item.unitPriceCents * item.quantity)}
                </p>
              </div>
            </article>
          ))}
        </div>

        <aside className="h-fit space-y-5 rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Order Summary</h2>

          <div className="flex justify-between">
            <span>Items</span>
            <span>{checkout.itemCount}</span>
          </div>

          <div className="flex justify-between border-t pt-4">
            <span>Subtotal</span>
            <strong>{formatUsd(checkout.subtotalCents)}</strong>
          </div>

          <div className="flex justify-between text-sm">
            <span>Shipping (test)</span>
            <span>$0.00</span>
          </div>

          <div className="flex justify-between text-sm">
            <span>Tax (test)</span>
            <span>$0.00</span>
          </div>

          <p className="text-xs text-neutral-500">
            Shipping and tax are set to zero for this test-mode implementation.
          </p>

          {requestError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {requestError.message}
            </p>
          )}

          {actionMessage && (
            <p role="status" className="text-sm text-neutral-700">
              {actionMessage}
            </p>
          )}

          <button
            type="button"
            disabled={isSubmitting || previewQuery.isFetching}
            onClick={() => {
              setActionMessage("");
              createMutation.mutate();
            }}
            className="w-full rounded-xl bg-neutral-900 px-5 py-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {createMutation.isPending
              ? "Opening Stripe..."
              : "Pay with Stripe (Test Mode)"}
          </button>

          <Link
            to="/cart"
            className="block rounded-xl border border-neutral-300 px-5 py-3 text-center text-sm"
          >
            Return to Cart
          </Link>
        </aside>
      </div>
    </section>
  );
}
