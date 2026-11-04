import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Link, useLocation, useNavigate } from "react-router";

import { useQueryClient } from "@tanstack/react-query";

import { loginUser } from "../lib/auth";
import { useGuestCart } from "../contexts/GuestCartContext";
import { CURRENT_USER_QUERY_KEY } from "../hooks/useCurrentUser";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const guestCart = useGuestCart();

  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginValues) {
    setServerError("");

    try {
      const user = await loginUser(values);

      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user);

      // Never retain another account's cached cart.
      queryClient.removeQueries({
        queryKey: ["cart"],
      });

      const state = location.state as { from?: string } | null;

      const requestedPath = state?.from;

      const safeDestination =
        requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
          ? requestedPath
          : "/account";

      navigate(guestCart.items.length > 0 ? "/cart" : safeDestination, {
        replace: true,
      });
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unable to sign in",
      );
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-7">
      <header>
        <h1 className="text-4xl font-semibold">Welcome back</h1>

        <p className="mt-2 text-neutral-600">Sign in to your Forma account.</p>
      </header>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6"
      >
        {serverError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {serverError}
          </p>
        )}

        <div>
          <label
            htmlFor="login-email"
            className="mb-2 block text-sm font-medium"
          >
            Email
          </label>

          <input
            id="login-email"
            type="email"
            autoComplete="email"
            {...register("email")}
            className="w-full rounded-lg border border-neutral-300 px-4 py-3"
          />

          {errors.email && (
            <p className="mt-1 text-sm text-red-700">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="mb-2 block text-sm font-medium"
          >
            Password
          </label>

          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            {...register("password")}
            className="w-full rounded-lg border border-neutral-300 px-4 py-3"
          />

          {errors.password && (
            <p className="mt-1 text-sm text-red-700">
              {errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-neutral-900 px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-neutral-600">
        Don't have an account?{" "}
        <Link to="/register" className="font-semibold text-orange-700">
          Create an account
        </Link>
      </p>
    </section>
  );
}
