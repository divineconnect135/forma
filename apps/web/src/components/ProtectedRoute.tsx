import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { useCurrentUser } from "../hooks/useCurrentUser";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();

  const { data: user, isPending, isError, refetch } = useCurrentUser();

  if (isPending) {
    return (
      <div role="status" className="py-16 text-center">
        Checking your session...
      </div>
    );
  }

  if (isError) {
    return (
      <section role="alert" className="py-16 text-center">
        <p>Unable to verify your session.</p>

        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 text-orange-700 underline"
        >
          Try again
        </button>
      </section>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname + location.search,
        }}
      />
    );
  }

  return <>{children}</>;
}
