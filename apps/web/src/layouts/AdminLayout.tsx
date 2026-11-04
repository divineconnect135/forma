import { NavLink, Outlet } from "react-router";

import { useCurrentUser } from "../hooks/useCurrentUser";

const links = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/inventory", label: "Inventory" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/customers", label: "Customers" },
  { to: "/admin/audit", label: "Audit Logs" },
];

export function AdminLayout() {
  const user = useCurrentUser();

  if (user.isPending) {
    return (
      <p role="status" className="py-12">
        Verifying administrator access...
      </p>
    );
  }

  if (user.isError) {
    return (
      <section role="alert" className="space-y-3">
        <p>Unable to verify administrator access.</p>
        <button
          type="button"
          onClick={() => void user.refetch()}
          className="text-orange-700 underline"
        >
          Retry
        </button>
      </section>
    );
  }

  if (user.data?.role !== "admin") {
    return (
      <section role="alert" className="py-16 text-center">
        <h1 className="text-3xl font-semibold">
          Administrator access required
        </h1>
        <p className="mt-3 text-neutral-600">
          You do not have access to this area.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <nav
        aria-label="Admin navigation"
        className="flex flex-wrap gap-2 border-b border-neutral-200 pb-4"
      >
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              [
                "rounded-lg px-4 py-2 text-sm font-medium",
                isActive
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-700 hover:bg-neutral-100",
              ].join(" ")
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
