import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getAdminCustomers } from "../lib/admin";

export function AdminCustomersPage() {
  const [page, setPage] = useState(1);

  const customers = useQuery({
    queryKey: ["admin", "customers", page],
    queryFn: () => getAdminCustomers(page),
    retry: false,
  });

  return (
    <section className="space-y-7">
      <header>
        <h1 className="text-3xl font-semibold">Customer Overview</h1>
        <p className="mt-2 text-neutral-600">
          View registered customer accounts.
        </p>
      </header>

      {customers.isPending && <p role="status">Loading customers...</p>}

      {customers.isError && (
        <p role="alert">
          Unable to load customers.{" "}
          <button
            type="button"
            onClick={() => void customers.refetch()}
            className="underline"
          >
            Retry
          </button>
        </p>
      )}

      {customers.data && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Registered</th>
                </tr>
              </thead>

              <tbody>
                {customers.data.data.map((customer) => (
                  <tr key={customer.id} className="border-t border-neutral-200">
                    <td className="p-4 font-medium">{customer.name}</td>

                    <td className="p-4">{customer.email}</td>

                    <td className="p-4">
                      {customer.active ? "Active" : "Inactive"}
                    </td>

                    <td className="p-4">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {customers.data.data.length === 0 && (
              <p className="p-8 text-center">No customers found.</p>
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
              Page {page} of {Math.max(1, customers.data.pagination.totalPages)}
            </span>

            <button
              type="button"
              disabled={page >= customers.data.pagination.totalPages}
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
