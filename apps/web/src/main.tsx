import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RouterProvider } from "react-router";

import { GuestCartProvider } from "./contexts/GuestCartContext";
import { router } from "./routes/router";

import "./styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <GuestCartProvider>
        <RouterProvider router={router} />
      </GuestCartProvider>
    </QueryClientProvider>
  </StrictMode>,
);
