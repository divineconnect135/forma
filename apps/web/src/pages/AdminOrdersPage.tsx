import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { getAdminOrders, type PaymentStatus } from "../lib/admin";
import { formatUsd } from "../lib/money";

export function AdminOrdersPage() {
  const [page, setPage] = useState(1);

  const [status, setStatus] = useState<PaymentStatus | "all">("all");

  const orders = useQuery({
    queryKey: ["admin", "orders", page, status],
    queryFn: () => getAdminOrders(page, status),
    retry: false,
  });

  return (
    <section className="space-y-7">
      <header>
        <h1 className="text-3xl font-semibold">Order Management</h1>
        <p className="mt-2 text-neutral-600">
          Monitor payments and manage fulfillment.
        </p>
      </header>

      <label className="text-sm">
        Payment status
        <select
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value as typeof status);
          }}
          className="ml-3 rounded-lg border p-2"
        >
          <option value="all">All orders</option>
          <option value="pending_payment">Pending payment</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
          <option value="refunded">Refunded</option>
        </select>
      </label>

      {orders.isPending && <p role="status">Loading orders...</p>}

      {orders.isError && (
        <p role="alert">
          Unable to load orders.{" "}
          <button
            type="button"
            onClick={() => void orders.refetch()}
            className="underline"
          >
            Retry
          </button>
        </p>
      )}

      {orders.data && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="p-4">Order</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4">Fulfillment</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Action</th>
                </tr>
              </thead>

              <tbody>
                {orders.data.data.map((order) => (
                  <tr key={order.id} className="border-t border-neutral-200">
                    <td className="p-4">
                      <p className="font-semibold">{order.orderNumber}</p>
                      <p className="text-xs text-neutral-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </td>

                    <td className="p-4 capitalize">
                      {order.status.replaceAll("_", " ")}
                    </td>

                    <td className="p-4 capitalize">
                      {order.fulfillmentStatus}
                    </td>

                    <td className="p-4 font-medium">
                      {formatUsd(order.totalCents)}
                    </td>

                    <td className="p-4">
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="text-orange-700 underline"
                      >
                        View details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {orders.data.data.length === 0 && (
              <p className="p-8 text-center">No matching orders.</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-lg border px-4 py-2 disabled:opacity-40"
            >
              Previous
            </button>

            <span>
              Page {page} of {Math.max(1, orders.data.pagination.totalPages)}
            </span>

            <button
              type="button"
              disabled={page >= orders.data.pagination.totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border px-4 py-2 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
