import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import { archiveAdminProduct, getAdminProducts } from "../lib/admin";
import { formatUsd } from "../lib/money";

export function AdminProductsPage() {
  const [page, setPage] = useState(1);
  const [archiveId, setArchiveId] = useState("");

  const queryClient = useQueryClient();

  const products = useQuery({
    queryKey: ["admin", "products", page],
    queryFn: () => getAdminProducts(page),
    retry: false,
  });

  const archive = useMutation({
    mutationFn: archiveAdminProduct,
    onSuccess: async () => {
      setArchiveId("");
      await queryClient.invalidateQueries({
        queryKey: ["admin"],
      });
    },
  });

  return (
    <section className="space-y-7">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Product Management</h1>
          <p className="mt-2 text-neutral-600">
            Create, edit, and archive catalog products.
          </p>
        </div>

        <Link
          to="/admin/products/new"
          className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white"
        >
          Create Product
        </Link>
      </header>

      {products.isPending && <p role="status">Loading products...</p>}

      {products.isError && (
        <div role="alert" className="space-y-3">
          <p>Unable to load products.</p>
          <button
            type="button"
            onClick={() => void products.refetch()}
            className="text-orange-700 underline"
          >
            Retry
          </button>
        </div>
      )}

      {archive.isError && (
        <p role="alert" className="text-sm text-red-700">
          {archive.error instanceof Error
            ? archive.error.message
            : "Archiving failed"}
        </p>
      )}

      {products.data && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="p-4">Product</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Featured</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>

              <tbody>
                {products.data.data.map((product) => (
                  <tr key={product.id} className="border-t border-neutral-200">
                    <td className="p-4">
                      <p className="font-semibold">{product.name}</p>
                      <p className="text-xs text-neutral-500">{product.slug}</p>
                    </td>
                    <td className="p-4">{formatUsd(product.priceCents)}</td>
                    <td className="p-4 capitalize">{product.status}</td>
                    <td className="p-4">{product.featured ? "Yes" : "No"}</td>
                    <td className="space-x-3 p-4">
                      <Link
                        to={`/admin/products/${product.id}`}
                        className="font-medium text-orange-700 underline"
                      >
                        Edit
                      </Link>

                      {product.status !== "archived" && (
                        <button
                          type="button"
                          onClick={() => setArchiveId(product.id)}
                          className="text-red-700 underline"
                        >
                          Archive
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {products.data.data.length === 0 && (
              <p className="p-8 text-center text-neutral-500">
                No products found.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-lg border px-4 py-2 disabled:opacity-40"
            >
              Previous
            </button>

            <span className="text-sm">
              Page {page} of {Math.max(1, products.data.pagination.totalPages)}
            </span>

            <button
              type="button"
              disabled={page >= products.data.pagination.totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border px-4 py-2 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}

      {archiveId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm product archive"
          className="rounded-2xl border border-red-200 bg-white p-6"
        >
          <h2 className="text-lg font-semibold">Archive this product?</h2>

          <p className="mt-2 text-sm text-neutral-600">
            It will disappear from the active catalog. Existing orders will be
            preserved.
          </p>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              disabled={archive.isPending}
              onClick={() => archive.mutate(archiveId)}
              className="rounded-lg bg-red-800 px-5 py-3 text-sm text-white"
            >
              Confirm Archive
            </button>

            <button
              type="button"
              onClick={() => setArchiveId("")}
              className="rounded-lg border px-5 py-3 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
