import { useState } from "react";

import { Link, NavLink, Outlet, useNavigate } from "react-router";

import { useQueryClient } from "@tanstack/react-query";

import { logoutUser } from "../lib/auth";
import { useCurrentUser } from "../hooks/useCurrentUser";

function navClass({ isActive }: { isActive: boolean }) {
  return `text-sm transition hover:text-neutral-950 ${
    isActive ? "font-semibold text-neutral-950" : "text-neutral-600"
  }`;
}

export function SiteLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: user, isPending } = useCurrentUser();

  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLogoutError("");
    setLoggingOut(true);

    try {
      await logoutUser();

      queryClient.setQueryData(["auth", "me"], null);

      queryClient.removeQueries({
        queryKey: ["cart"],
      });

      navigate("/login", { replace: true });
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "Unable to sign out",
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f7f4] text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-5">
          <Link to="/" className="text-2xl font-black tracking-[-0.09em]">
            FORMA
            <span className="text-orange-600">.</span>
          </Link>

          <nav
            aria-label="Primary navigation"
            className="flex flex-wrap items-center gap-5 sm:gap-7"
          >
            <NavLink to="/" end className={navClass}>
              Home
            </NavLink>

            <NavLink to="/products" className={navClass}>
              Products
            </NavLink>

            <NavLink to="/cart" className={navClass}>
              Cart
            </NavLink>

            {!isPending &&
              (user ? (
                <>
                  <NavLink to="/account" className={navClass}>
                    My Account
                  </NavLink>

                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={loggingOut}
                    className="text-sm text-red-700 disabled:opacity-50"
                  >
                    {loggingOut ? "Signing out..." : "Logout"}
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className={navClass}>
                    Login
                  </NavLink>

                  <NavLink to="/register" className={navClass}>
                    Register
                  </NavLink>
                </>
              ))}
          </nav>
        </div>

        {logoutError && (
          <p
            role="alert"
            className="mx-auto max-w-6xl px-6 pb-3 text-sm text-red-700"
          >
            {logoutError}
          </p>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 md:py-16">
        <Outlet />
      </main>

      <footer className="border-t border-neutral-200 bg-white px-6 py-6 text-center text-xs text-neutral-500">
        © Forma · Portfolio demonstration · Test payments only
      </footer>
    </div>
  );
}
