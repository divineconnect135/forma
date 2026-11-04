import { Link } from "react-router";

import { useCurrentUser } from "../hooks/useCurrentUser";

export function AccountPage() {
  const { data: user } = useCurrentUser();

  if (!user) return null;

  const isAdmin = user.role === "admin";

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-orange-700">
          My Forma
        </p>

        <h1 className="mt-3 text-4xl font-semibold">My Account</h1>

        <p className="mt-2 text-neutral-600">Welcome back, {user.name}.</p>
      </header>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Account information</h2>

        <dl className="mt-5 space-y-4">
          <div>
            <dt className="text-sm text-neutral-500">Name</dt>

            <dd className="font-medium">{user.name}</dd>
          </div>

          <div>
            <dt className="text-sm text-neutral-500">Email</dt>

            <dd className="font-medium">{user.email}</dd>
          </div>

          <div>
            <dt className="text-sm text-neutral-500">Account type</dt>

            <dd className="font-medium capitalize">{user.role}</dd>
          </div>
        </dl>
      </div>

      {isAdmin && (
        <Link
          to="/admin"
          className="block rounded-2xl border border-orange-200 bg-orange-50 p-6 transition hover:border-orange-400"
        >
          <h2 className="text-xl font-semibold">Admin Dashboard</h2>

          <p className="mt-2 text-sm text-neutral-700">
            Monitor products, inventory, orders, and Stripe test-mode sales.
          </p>

          <p className="mt-5 text-sm font-semibold text-orange-800">
            Open administration
          </p>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/orders"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:border-neutral-400"
        >
          <h2 className="text-xl font-semibold">My Orders</h2>

          <p className="mt-2 text-sm text-neutral-600">
            View purchases, payment statuses, and pending checkouts.
          </p>

          <p className="mt-5 text-sm font-medium text-orange-700">
            View order history
          </p>
        </Link>

        <Link
          to="/cart"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:border-neutral-400"
        >
          <h2 className="text-xl font-semibold">My Cart</h2>

          <p className="mt-2 text-sm text-neutral-600">
            Review saved items and continue shopping.
          </p>

          <p className="mt-5 text-sm font-medium text-orange-700">
            View shopping cart
          </p>
        </Link>
      </div>

      <Link
        to="/products"
        className="inline-block rounded-xl bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
      >
        Browse Products
      </Link>
    </section>
  );
}
