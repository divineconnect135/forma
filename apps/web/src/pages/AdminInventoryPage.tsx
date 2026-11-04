import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import {
  adjustAdminStock,
  getAdminInventory,
  type AdminInventoryVariant,
} from "../lib/admin";

export function AdminInventoryPage() {
  const [page, setPage] = useState(1);

  const [filter, setFilter] = useState<"all" | "low" | "out">("all");

  const [selected, setSelected] = useState<AdminInventoryVariant | null>(null);

  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");

  const queryClient = useQueryClient();

  const inventory = useQuery({
    queryKey: ["admin", "inventory", page, filter],
    queryFn: () => getAdminInventory(page, filter),
    retry: false,
  });

  const adjustment = useMutation({
    mutationFn: () => adjustAdminStock(selected!.id, delta, reason),

    onSuccess: async () => {
      setSelected(null);
      setDelta(0);
      setReason("");

      await queryClient.invalidateQueries({
        queryKey: ["admin"],
      });
    },
  });

  return (
    <section className="space-y-7">
      <header>
        <h1 className="text-3xl font-semibold">Inventory Management</h1>
        <p className="mt-2 text-neutral-600">
          Adjust physical stock without changing checkout reservations.
        </p>
      </header>

      <label className="block text-sm">
        Stock filter
        <select
          value={filter}
          onChange={(event) => {
            setPage(1);
            setFilter(event.target.value as typeof filter);
          }}
          className="ml-3 rounded-lg border p-2"
        >
          <option value="all">All variants</option>
          <option value="low">Low stock (1–5)</option>
          <option value="out">Out of stock</option>
        </select>
      </label>

      {inventory.isPending && <p role="status">Loading inventory...</p>}

      {inventory.isError && (
        <p role="alert">
          Unable to load inventory.{" "}
          <button
            type="button"
            onClick={() => void inventory.refetch()}
            className="underline"
          >
            Retry
          </button>
        </p>
      )}

      {inventory.data && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="p-4">Product / SKU</th>
                  <th className="p-4">On Hand</th>
                  <th className="p-4">Reserved</th>
                  <th className="p-4">Available</th>
                  <th className="p-4">Action</th>
                </tr>
              </thead>

              <tbody>
                {inventory.data.data.map((variant) => (
                  <tr key={variant.id} className="border-t border-neutral-200">
                    <td className="p-4">
                      <Link
                        to={`/admin/products/${variant.productId}`}
                        className="font-semibold text-orange-700 hover:underline"
                      >
                        {variant.productName}
                      </Link>
                      <p className="text-xs text-neutral-500">
                        {variant.sku} · {variant.color}
                      </p>
                    </td>

                    <td className="p-4">{variant.stockOnHand}</td>

                    <td className="p-4">{variant.stockReserved}</td>

                    <td className="p-4 font-semibold">
                      {variant.availableQuantity}
                    </td>

                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(variant);
                          setDelta(0);
                          setReason("");
                        }}
                        className="text-orange-700 underline"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {inventory.data.data.length === 0 && (
              <p className="p-8 text-center">No matching inventory records.</p>
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

            <span className="text-sm">
              Page {page} of {Math.max(1, inventory.data.pagination.totalPages)}
            </span>

            <button
              type="button"
              disabled={page >= inventory.data.pagination.totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border px-4 py-2 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}

      {selected && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            adjustment.mutate();
          }}
          className="space-y-4 rounded-2xl border border-neutral-300 bg-white p-6"
        >
          <h2 className="text-xl font-semibold">Adjust {selected.sku}</h2>

          <p className="text-sm text-neutral-600">
            Current on hand: {selected.stockOnHand}. Reserved:{" "}
            {selected.stockReserved}.
          </p>

          <label className="block text-sm">
            Change in units (+ or −)
            <input
              required
              type="number"
              step="1"
              min="-10000"
              max="10000"
              value={delta}
              onChange={(event) => setDelta(Number(event.target.value))}
              className="mt-1 block w-full rounded-lg border p-3"
            />
          </label>

          <label className="block text-sm">
            Reason
            <textarea
              required
              minLength={8}
              maxLength={180}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Received new stock delivery"
              className="mt-1 block w-full rounded-lg border p-3"
            />
          </label>

          <p className="text-sm text-neutral-600">
            Resulting stock on hand: {selected.stockOnHand + delta}
          </p>

          {adjustment.isError && (
            <p role="alert" className="text-sm text-red-700">
              {adjustment.error.message}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={
                adjustment.isPending || delta === 0 || !Number.isInteger(delta)
              }
              className="rounded-lg bg-neutral-900 px-5 py-3 text-sm text-white disabled:opacity-40"
            >
              Confirm Adjustment
            </button>

            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg border px-5 py-3 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
