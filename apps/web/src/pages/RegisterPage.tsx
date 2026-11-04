import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Link, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

import { registerUser } from "../lib/auth";
import { useGuestCart } from "../contexts/GuestCartContext";

import { CURRENT_USER_QUERY_KEY } from "../hooks/useCurrentUser";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),

  email: z.string().email("Enter a valid email"),

  password: z
    .string()
    .min(12, "Password must contain at least 12 characters")
    .max(128),
});

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const guestCart = useGuestCart();

  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: RegisterValues) {
    setServerError("");

    try {
      const user = await registerUser(values);

      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user);

      queryClient.removeQueries({
        queryKey: ["cart"],
      });

      navigate(guestCart.items.length > 0 ? "/cart" : "/account", {
        replace: true,
      });
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unable to register",
      );
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-7">
      <header>
        <h1 className="text-4xl font-semibold">Create your account</h1>

        <p className="mt-2 text-neutral-600">
          Join Forma to save your cart and manage orders.
        </p>
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
            htmlFor="register-name"
            className="mb-2 block text-sm font-medium"
          >
            Full name
          </label>

          <input
            id="register-name"
            autoComplete="name"
            {...register("name")}
            className="w-full rounded-lg border border-neutral-300 px-4 py-3"
          />

          {errors.name && (
            <p className="mt-1 text-sm text-red-700">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="register-email"
            className="mb-2 block text-sm font-medium"
          >
            Email
          </label>

          <input
            id="register-email"
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
            htmlFor="register-password"
            className="mb-2 block text-sm font-medium"
          >
            Password
          </label>

          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
            className="w-full rounded-lg border border-neutral-300 px-4 py-3"
          />

          <p className="mt-1 text-xs text-neutral-500">
            Use at least 12 characters.
          </p>

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
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-neutral-600">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-orange-700">
          Sign in
        </Link>
      </p>
    </section>
  );
}
