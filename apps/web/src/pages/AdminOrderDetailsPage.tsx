import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import {
  getAdminOrder,
  updateAdminFulfillment,
  type FulfillmentStatus,
} from "../lib/admin";

import { formatUsd } from "../lib/money";

const nextStatus: Partial<
  Record<FulfillmentStatus, Exclude<FulfillmentStatus, "unfulfilled">>
> = {
  unfulfilled: "processing",
  processing: "shipped",
  shipped: "delivered",
};

export function AdminOrderDetailsPage() {
  const { orderId } = useParams<"orderId">();
  const queryClient = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ["admin", "order", orderId],
    queryFn: () => getAdminOrder(orderId!),
    enabled: Boolean(orderId),
    retry: false,
  });

  const fulfillment = useMutation({
    mutationFn: (status: Exclude<FulfillmentStatus, "unfulfilled">) =>
      updateAdminFulfillment(orderId!, status),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin"],
      });
    },
  });

  if (orderQuery.isPending) {
    return <p role="status">Loading order...</p>;
  }

  if (orderQuery.isError) {
    return <p role="alert">Unable to load order.</p>;
  }

  const order = orderQuery.data.data;

  const next = nextStatus[order.fulfillmentStatus];

  return (
    <section className="mx-auto max-w-4xl space-y-7">
      <Link to="/admin/orders" className="text-orange-700 underline">
        Back to admin orders
      </Link>

      <header>
        <h1 className="text-3xl font-semibold">{order.orderNumber}</h1>

        <p className="mt-2 text-neutral-600">
          Payment: {order.status.replaceAll("_", " ")}
        </p>

        <p className="text-neutral-600">
          Fulfillment: {order.fulfillmentStatus}
        </p>
      </header>

      {order.customer && (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold">Customer</h2>

          <p className="mt-3">{order.customer.name}</p>
          <p className="text-neutral-600">{order.customer.email}</p>
        </section>
      )}

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Ordered Items</h2>

        <div className="mt-5 space-y-4">
          {order.items.map((item, index) => (
            <div
              key={`${item.sku}-${index}`}
              className="flex justify-between gap-5 border-t pt-4"
            >
              <div>
                <p className="font-medium">{item.productName}</p>
                <p className="text-sm text-neutral-600">
                  {item.sku} · {item.color}
                </p>
                <p className="text-sm">Quantity: {item.quantity}</p>
              </div>

              <strong>{formatUsd(item.lineTotalCents)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Order Summary</h2>

        <div className="flex justify-between">
          <span>Subtotal</span>
          <strong>{formatUsd(order.subtotalCents)}</strong>
        </div>

        <div className="flex justify-between">
          <span>Shipping</span>
          <span>{formatUsd(order.shippingCents)}</span>
        </div>

        <div className="flex justify-between">
          <span>Tax</span>
          <span>{formatUsd(order.taxCents)}</span>
        </div>

        <div className="flex justify-between border-t pt-4">
          <strong>Total</strong>
          <strong>{formatUsd(order.totalCents)}</strong>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Fulfillment</h2>

        {order.status !== "paid" ? (
          <p className="text-sm text-neutral-600">
            Fulfillment is unavailable until payment has been verified.
          </p>
        ) : next ? (
          <>
            <p className="text-sm text-neutral-600">Next step: {next}</p>

            <button
              type="button"
              disabled={fulfillment.isPending}
              onClick={() => {
                if (window.confirm(`Change fulfillment to ${next}?`)) {
                  fulfillment.mutate(next);
                }
              }}
              className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              Mark as {next}
            </button>
          </>
        ) : (
          <p className="text-sm text-green-800">Fulfillment completed.</p>
        )}

        {fulfillment.isError && (
          <p role="alert" className="text-sm text-red-700">
            {fulfillment.error.message}
          </p>
        )}
      </section>
    </section>
  );
}
