import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Link, useParams } from "react-router";

import { useCurrentUser } from "../hooks/useCurrentUser";

import {
  cancelPendingCheckout,
  getOrderDetails,
  getOrderStatusLabel,
} from "../lib/orders";

import { formatUsd } from "../lib/money";

export function OrderDetailsPage() {
  const { orderId } = useParams<"orderId">();

  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();

  const [confirmCancel, setConfirmCancel] = useState(false);

  const orderQuery = useQuery({
    queryKey: ["order", currentUser.data?.id, orderId],

    queryFn: () => getOrderDetails(orderId!),

    enabled: Boolean(currentUser.data && orderId),

    staleTime: 0,
    retry: false,
  });

  const cancellation = useMutation({
    mutationFn: () => cancelPendingCheckout(orderId!),

    onSuccess: async () => {
      setConfirmCancel(false);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["orders"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["order"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["cart"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["checkout"],
        }),
      ]);
    },

    onError: () => {
      // Stripe might have completed concurrently.
      // Refresh so the user sees the newest state.
      void orderQuery.refetch();
    },
  });

  if (currentUser.isPending || orderQuery.isPending) {
    return (
      <p role="status" className="py-12">
        Loading order details...
      </p>
    );
  }

  if (currentUser.isError || orderQuery.isError) {
    return (
      <section role="alert" className="space-y-4">
        <h1 className="text-2xl font-semibold">Unable to load order</h1>

        <p className="text-neutral-600">
          The order was not found or cannot be accessed.
        </p>

        <Link to="/orders" className="text-orange-700 underline">
          Back to orders
        </Link>
      </section>
    );
  }

  const order = orderQuery.data?.data;

  if (!order) return null;

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <nav aria-label="Breadcrumb">
        <Link to="/orders" className="text-sm text-orange-700 underline">
          Back to my orders
        </Link>
      </nav>

      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-700">
          Order details
        </p>

        <h1 className="wrap-break-word text-3xl font-semibold md:text-4xl">
          {order.orderNumber}
        </h1>

        <p className="text-neutral-600">
          Placed {new Date(order.createdAt).toLocaleString()}
        </p>

        <span className="inline-block rounded-full bg-neutral-200 px-4 py-2 text-sm font-medium">
          {getOrderStatusLabel(order.status)}
        </span>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Items ordered</h2>

          {order.items.map((item) => (
            <article
              key={item.variantId}
              className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <h3 className="text-lg font-semibold">{item.productName}</h3>

              <p className="text-sm text-neutral-600">
                {[item.color, item.size].filter(Boolean).join(" · ")}
              </p>

              <p className="text-xs text-neutral-500">SKU: {item.sku}</p>

              <div className="flex flex-wrap justify-between gap-3">
                <span>
                  {item.quantity} × {formatUsd(item.unitPriceCents)}
                </span>

                <strong>{formatUsd(item.lineTotalCents)}</strong>
              </div>

              <Link
                to={`/products/${item.productSlug}`}
                className="inline-block text-sm font-medium text-orange-700 underline"
              >
                View product
              </Link>
            </article>
          ))}
        </div>

        <aside className="h-fit space-y-5 rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Payment Summary</h2>

          <div className="flex justify-between">
            <span>Subtotal</span>
            <strong>{formatUsd(order.subtotalCents)}</strong>
          </div>

          <div className="flex justify-between text-sm">
            <span>Shipping</span>
            <span>{formatUsd(order.shippingCents)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span>Tax</span>
            <span>{formatUsd(order.taxCents)}</span>
          </div>

          <div className="flex justify-between border-t border-neutral-200 pt-4 text-lg">
            <strong>Total</strong>
            <strong>{formatUsd(order.totalCents)}</strong>
          </div>

          {order.status === "pending_payment" && (
            <p className="text-sm leading-6 text-neutral-600">
              Payment has not been confirmed. Inventory may currently be
              reserved.
            </p>
          )}

          {order.status === "paid" && (
            <p className="text-sm text-green-800">Payment confirmed.</p>
          )}

          {order.canCancel && !confirmCancel && (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="w-full rounded-xl border border-red-300 px-5 py-3 text-sm font-semibold text-red-800"
            >
              Cancel pending checkout
            </button>
          )}

          {order.canCancel && confirmCancel && (
            <div className="space-y-4 rounded-xl border border-red-200 p-4">
              <p className="text-sm text-neutral-700">
                This will expire your open Stripe Checkout Session. It cannot
                refund an already completed payment.
              </p>

              <button
                type="button"
                disabled={cancellation.isPending}
                onClick={() => cancellation.mutate()}
                className="w-full rounded-lg bg-red-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {cancellation.isPending
                  ? "Checking Stripe..."
                  : "Confirm cancellation"}
              </button>

              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="w-full text-sm text-neutral-600 underline"
              >
                Keep checkout
              </button>
            </div>
          )}

          {cancellation.isError && (
            <p role="alert" className="text-sm text-red-700">
              {cancellation.error instanceof Error
                ? cancellation.error.message
                : "Unable to cancel checkout"}
            </p>
          )}

          <Link
            to="/orders"
            className="block rounded-xl border border-neutral-300 px-5 py-3 text-center text-sm"
          >
            All orders
          </Link>
        </aside>
      </div>
    </section>
  );
}
