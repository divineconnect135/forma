import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getAdminAudit } from "../lib/admin";

export function AdminAuditPage() {
  const [page, setPage] = useState(1);

  const audits = useQuery({
    queryKey: ["admin", "audit", page],
    queryFn: () => getAdminAudit(page),
    retry: false,
  });

  return (
    <section className="space-y-7">
      <header>
        <h1 className="text-3xl font-semibold">Admin Audit Logs</h1>

        <p className="mt-2 text-neutral-600">
          Read-only history of administrative changes.
        </p>
      </header>

      {audits.isPending && <p role="status">Loading audit history...</p>}

      {audits.isError && (
        <p role="alert">
          Unable to load audit logs.{" "}
          <button
            type="button"
            onClick={() => void audits.refetch()}
            className="underline"
          >
            Retry
          </button>
        </p>
      )}

      {audits.data && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Resource</th>
                  <th className="p-4">Actor ID</th>
                  <th className="p-4">Details</th>
                </tr>
              </thead>

              <tbody>
                {audits.data.data.map((audit) => (
                  <tr
                    key={audit.id}
                    className="border-t border-neutral-200 align-top"
                  >
                    <td className="p-4">
                      {new Date(audit.createdAt).toLocaleString()}
                    </td>

                    <td className="p-4 font-medium">{audit.action}</td>

                    <td className="p-4">
                      <p>{audit.resourceType}</p>
                      <p className="break-all font-mono text-xs text-neutral-500">
                        {audit.resourceId}
                      </p>
                    </td>

                    <td className="break-all p-4 font-mono text-xs">
                      {audit.actorId}
                    </td>

                    <td className="p-4">
                      <pre className="max-w-64 overflow-auto whitespace-pre-wrap break-words text-xs">
                        {JSON.stringify(audit.metadata, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {audits.data.data.length === 0 && (
              <p className="p-8 text-center">No audit records yet.</p>
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
              Page {page} of {Math.max(1, audits.data.pagination.totalPages)}
            </span>

            <button
              type="button"
              disabled={page >= audits.data.pagination.totalPages}
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
