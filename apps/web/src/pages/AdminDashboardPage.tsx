import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { useCurrentUser } from "../hooks/useCurrentUser";

import { getAdminOverview, type AdminRecentOrder } from "../lib/admin";

import { formatUsd } from "../lib/money";

function formatStatus(status: AdminRecentOrder["status"]) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
        {label}
      </p>

      <p className="break-words text-3xl font-semibold tracking-tight text-neutral-950">
        {value}
      </p>

      <p className="text-sm leading-6 text-neutral-600">{description}</p>
    </div>
  );
}

export function AdminDashboardPage() {
  const currentUser = useCurrentUser();

  const isAdmin = currentUser.data?.role === "admin";

  const overviewQuery = useQuery({
    queryKey: ["admin", "overview", currentUser.data?.id],

    queryFn: getAdminOverview,

    enabled: isAdmin,

    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  if (currentUser.isPending) {
    return (
      <section role="status" className="space-y-6">
        <div className="h-10 w-64 animate-pulse rounded bg-neutral-200" />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl bg-neutral-200"
            />
          ))}
        </div>

        <p>Checking administrator access...</p>
      </section>
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

  if (!currentUser.data) {
    return (
      <section className="space-y-4 py-12">
        <h1 className="text-2xl font-semibold">Sign in required</h1>

        <Link to="/login" className="text-orange-700 underline">
          Sign in
        </Link>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section
        role="alert"
        className="mx-auto max-w-2xl space-y-5 py-16 text-center"
      >
        <h1 className="text-3xl font-semibold">
          Administrator access required
        </h1>

        <p className="text-neutral-600">
          This page is only available to authorized Forma administrators.
        </p>

        <Link
          to="/account"
          className="inline-block rounded-xl bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
        >
          Return to account
        </Link>
      </section>
    );
  }

  if (overviewQuery.isPending) {
    return (
      <section role="status" className="space-y-8">
        <h1 className="text-3xl font-semibold">Admin Dashboard</h1>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl bg-neutral-200"
            />
          ))}
        </div>

        <p>Loading dashboard statistics...</p>
      </section>
    );
  }

  if (overviewQuery.isError) {
    return (
      <section role="alert" className="space-y-5 py-12">
        <h1 className="text-2xl font-semibold">Unable to load dashboard</h1>

        <p className="text-neutral-600">
          {overviewQuery.error instanceof Error
            ? overviewQuery.error.message
            : "Unable to retrieve statistics"}
        </p>

        <button
          type="button"
          onClick={() => void overviewQuery.refetch()}
          className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white"
        >
          Try again
        </button>
      </section>
    );
  }

  const overview = overviewQuery.data.data;

  return (
    <section className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">
            Forma Administration
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Admin Dashboard
          </h1>

          <p className="mt-3 max-w-2xl text-neutral-600">
            Monitor product availability, customer activity, and Stripe test
            orders.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void overviewQuery.refetch()}
          disabled={overviewQuery.isFetching}
          className="rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-medium disabled:opacity-50"
        >
          {overviewQuery.isFetching ? "Refreshing..." : "Refresh data"}
        </button>
      </header>

      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
        All payment totals in this dashboard are Stripe test-mode demonstration
        data. They are not live business revenue.
      </div>

      {/* Primary KPIs */}
      <section aria-labelledby="overview-heading" className="space-y-5">
        <h2 id="overview-heading" className="text-2xl font-semibold">
          Overview
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Products"
            value={overview.products.total}
            description={`${overview.products.active} active products`}
          />

          <StatCard
            label="Total Orders"
            value={overview.orders.total}
            description={`${overview.orders.paid} paid test orders`}
          />

          <StatCard
            label="Gross Paid Sales"
            value={formatUsd(overview.paidSales.grossCents)}
            description="Test-mode paid orders; excludes refunded orders"
          />

          <StatCard
            label="Customers"
            value={overview.customers.total}
            description="Active customer accounts"
          />
        </div>
      </section>

      {/* Operational metrics */}
      <section aria-labelledby="operations-heading" className="space-y-5">
        <h2 id="operations-heading" className="text-2xl font-semibold">
          Operations
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Pending Payments"
            value={overview.orders.pending}
            description="Orders awaiting verified payment or expiration"
          />

          <StatCard
            label="Low Stock"
            value={overview.inventory.lowStockVariants}
            description="Active variants with 1–5 available units"
          />

          <StatCard
            label="Out of Stock"
            value={overview.inventory.outOfStockVariants}
            description="Active variants with no available units"
          />
        </div>
      </section>

      {/* Recent orders */}
      <section aria-labelledby="recent-orders-heading" className="space-y-5">
        <div>
          <h2 id="recent-orders-heading" className="text-2xl font-semibold">
            Recent Orders
          </h2>

          <p className="mt-2 text-sm text-neutral-600">
            The eight most recently created orders.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {overview.recentOrders.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-medium">No orders yet</p>

              <p className="mt-2 text-sm text-neutral-500">
                Orders will appear after customers start checkout.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-neutral-100 text-neutral-600">
                  <tr>
                    <th scope="col" className="px-5 py-4">
                      Order
                    </th>

                    <th scope="col" className="px-5 py-4">
                      Date
                    </th>

                    <th scope="col" className="px-5 py-4">
                      Status
                    </th>

                    <th scope="col" className="px-5 py-4 text-right">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {overview.recentOrders.map((order) => (
                    <tr key={order.id} className="border-t border-neutral-200">
                      <td className="px-5 py-4 font-medium">
                        {order.orderNumber}
                      </td>

                      <td className="px-5 py-4 text-neutral-600">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium">
                          {formatStatus(order.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right font-semibold">
                        {formatUsd(order.totalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <p className="text-xs text-neutral-500">
        This is a read-only dashboard. Product, inventory, and fulfillment
        controls will be added in the remaining Phase 6 steps.
      </p>
    </section>
  );
}
