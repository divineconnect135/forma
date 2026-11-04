import { useEffect, useRef } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Link, useSearchParams } from "react-router";

import { useCurrentUser } from "../hooks/useCurrentUser";

import { getCheckoutStatus } from "../lib/checkout";

import { formatUsd } from "../lib/money";

interface CheckoutReturnPageProps {
  outcome: "success" | "cancel";
}

export function CheckoutReturnPage({ outcome }: CheckoutReturnPageProps) {
  const [params] = useSearchParams();

  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();

  const sessionId = params.get("session_id") ?? "";

  const refreshedSession = useRef("");

  const isSuccess = outcome === "success";

  const validSessionId = /^cs_test_[A-Za-z0-9_]+$/.test(sessionId);

  const statusQuery = useQuery({
    queryKey: ["checkout", "status", currentUser.data?.id, sessionId],

    queryFn: () => getCheckoutStatus(sessionId),

    enabled: isSuccess && validSessionId && Boolean(currentUser.data),

    retry: false,

    refetchInterval: (query) =>
      query.state.data?.data.status === "pending_payment" ? 3000 : false,

    refetchIntervalInBackground: false,
  });

  const order = statusQuery.data?.data;

  // A verified paid order means MongoDB inventory
  // and cart cleanup have already committed.
  // Refresh cached cart/order information.
  useEffect(() => {
    if (
      !currentUser.data ||
      order?.status !== "paid" ||
      refreshedSession.current === sessionId
    ) {
      return;
    }

    refreshedSession.current = sessionId;

    void queryClient.invalidateQueries({
      queryKey: ["cart"],
    });

    void queryClient.invalidateQueries({
      queryKey: ["orders"],
    });
  }, [currentUser.data, order?.status, queryClient, sessionId]);

  if (!isSuccess) {
    return (
      <section className="mx-auto max-w-2xl space-y-6 py-16 text-center">
        <h1 className="text-4xl font-semibold">You left Stripe Checkout</h1>

        <p className="text-neutral-600">
          Returning here does not automatically cancel your pending order.
        </p>

        <p className="text-neutral-600">
          Open My Orders to review your checkout or cancel it if Stripe still
          allows expiration.
        </p>

        <Link
          to="/orders"
          className="inline-block rounded-xl bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
        >
          My Orders
        </Link>
      </section>
    );
  }

  if (!validSessionId) {
    return (
      <section className="mx-auto max-w-2xl space-y-5 py-16 text-center">
        <h1 className="text-3xl font-semibold">Unable to identify checkout</h1>

        <p className="text-neutral-600">
          A valid Stripe Session ID was not provided.
        </p>

        <Link to="/orders" className="text-orange-700 underline">
          View my orders
        </Link>
      </section>
    );
  }

  if (currentUser.isPending) {
    return (
      <p role="status" className="py-16 text-center">
        Checking your account...
      </p>
    );
  }

  if (currentUser.isError) {
    return (
      <section role="alert" className="py-16 text-center">
        Unable to verify your account.
        <button
          type="button"
          onClick={() => void currentUser.refetch()}
          className="ml-3 text-orange-700 underline"
        >
          Try again
        </button>
      </section>
    );
  }

  if (!currentUser.data) {
    return (
      <section className="mx-auto max-w-2xl space-y-5 py-16 text-center">
        <h1 className="text-3xl font-semibold">Sign in to check your order</h1>

        <Link
          to="/login"
          className="inline-block rounded-xl bg-neutral-900 px-6 py-3 text-white"
        >
          Sign in
        </Link>
      </section>
    );
  }

  if (statusQuery.isPending) {
    return (
      <p role="status" className="py-16 text-center">
        Checking your payment status...
      </p>
    );
  }

  if (statusQuery.isError || !order) {
    return (
      <section className="mx-auto max-w-2xl space-y-5 py-16 text-center">
        <h1 className="text-3xl font-semibold">Payment status unavailable</h1>

        <p role="alert" className="text-neutral-600">
          We could not retrieve the current order status.
        </p>

        <button
          type="button"
          onClick={() => void statusQuery.refetch()}
          className="text-orange-700 underline"
        >
          Try again
        </button>
      </section>
    );
  }

  const paid = order.status === "paid";

  const pending = order.status === "pending_payment";

  return (
    <section className="mx-auto max-w-2xl space-y-7 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-orange-700">
        Forma Order
      </p>

      <h1 className="text-4xl font-semibold" aria-live="polite">
        {paid
          ? "Payment confirmed"
          : pending
            ? "Payment verification pending"
            : "Checkout not completed"}
      </h1>

      <p className="text-neutral-600">
        {paid
          ? "Stripe payment has been verified and your order is recorded."
          : pending
            ? "Your payment is still being verified. This page will check again automatically."
            : "Your checkout did not result in a confirmed paid order."}
      </p>

      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-6 text-left">
        <div className="flex justify-between gap-3">
          <span className="text-neutral-600">Order number</span>

          <strong>{order.orderNumber}</strong>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-neutral-600">Order total</span>

          <strong>{formatUsd(order.totalCents)}</strong>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-neutral-600">Status</span>

          <strong className="capitalize">
            {order.status.replaceAll("_", " ")}
          </strong>
        </div>
      </div>

      {pending && (
        <button
          type="button"
          onClick={() => void statusQuery.refetch()}
          className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium"
        >
          Check again
        </button>
      )}

      <div className="flex flex-wrap justify-center gap-4">
        <Link
          to="/orders"
          className="rounded-xl bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
        >
          My Orders
        </Link>

        <Link
          to="/cart"
          className="rounded-xl border border-neutral-300 px-6 py-3 text-sm font-medium"
        >
          View cart
        </Link>
      </div>
    </section>
  );
}
