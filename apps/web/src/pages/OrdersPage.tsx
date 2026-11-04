import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { useCurrentUser } from "../hooks/useCurrentUser";

import { getOrders, getOrderStatusLabel } from "../lib/orders";

import { formatUsd } from "../lib/money";

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const currentUser = useCurrentUser();

  const ordersQuery = useQuery({
    queryKey: ["orders", currentUser.data?.id, page],

    queryFn: () => getOrders(page),

    enabled: Boolean(currentUser.data),

    staleTime: 0,
    retry: false,
  });

  if (currentUser.isPending || ordersQuery.isPending) {
    return (
      <p role="status" className="py-12">
        Loading your orders...
      </p>
    );
  }

  if (currentUser.isError || ordersQuery.isError) {
    return (
      <section role="alert" className="space-y-4">
        <h1 className="text-2xl font-semibold">Unable to load orders</h1>

        <button
          type="button"
          onClick={() => {
            if (currentUser.isError) {
              void currentUser.refetch();
            } else {
              void ordersQuery.refetch();
            }
          }}
          className="text-orange-700 underline"
        >
          Try again
        </button>
      </section>
    );
  }

  const result = ordersQuery.data;

  if (!result) return null;

  return (
    <section className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-700">
          My Forma
        </p>

        <h1 className="mt-3 text-4xl font-semibold">My Orders</h1>

        <p className="mt-2 text-neutral-600">
          Review purchases and pending checkouts.
        </p>
      </header>

      {result.data.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center">
          <h2 className="text-2xl font-semibold">No orders yet</h2>

          <p className="mt-3 text-neutral-600">
            Products you purchase will appear here.
          </p>

          <Link
            to="/products"
            className="mt-6 inline-block rounded-xl bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
          >
            Explore products
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {result.data.map((order) => (
            <article
              key={order.id}
              className="rounded-2xl border border-neutral-200 bg-white p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold">{order.orderNumber}</h2>

                  <p className="text-sm text-neutral-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>

                  <p className="text-sm text-neutral-600">
                    {order.itemCount} item
                    {order.itemCount === 1 ? "" : "s"}
                  </p>

                  <span className="inline-block rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium">
                    {getOrderStatusLabel(order.status)}
                  </span>
                </div>

                <div className="space-y-3 text-right">
                  <p className="text-xl font-semibold">
                    {formatUsd(order.totalCents)}
                  </p>

                  <Link
                    to={`/orders/${order.id}`}
                    className="inline-block rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
                  >
                    View details
                  </Link>
                </div>
              </div>
            </article>
          ))}

          <nav
            aria-label="Order pages"
            className="flex items-center justify-between gap-4 pt-4"
          >
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>

            <span className="text-sm text-neutral-600">
              Page {result.pagination.page} of {result.pagination.totalPages}
            </span>

            <button
              type="button"
              disabled={page >= result.pagination.totalPages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </section>
  );
}
