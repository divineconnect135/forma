import { isRouteErrorResponse, Link, useRouteError } from "react-router";

export function RouteErrorPage() {
  const error = useRouteError();

  const status = isRouteErrorResponse(error) ? error.status : null;

  const missingPage = status === 404;

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 py-16 text-center"
    >
      <p className="text-sm font-semibold uppercase tracking-widest text-orange-700">
        Forma
      </p>

      <h1 className="text-4xl font-semibold">
        {missingPage ? "Page not found" : "Unable to load this page"}
      </h1>

      <p className="text-neutral-600">
        {missingPage
          ? "The requested page does not exist."
          : "A page resource could not be loaded. Check your connection or try refreshing."}
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-neutral-900 px-6 py-3 text-sm font-medium text-white"
        >
          Refresh page
        </button>

        <Link
          to="/"
          className="rounded-xl border border-neutral-300 px-6 py-3 text-sm font-medium"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
