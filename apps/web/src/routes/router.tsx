import { createBrowserRouter } from "react-router";

import { SiteLayout } from "../layouts/SiteLayout";

import { ProtectedRoute } from "../components/ProtectedRoute";

import { HomePage } from "../pages/HomePage";
import { ProductsPage } from "../pages/ProductsPage";
import { ProductDetailsPage } from "../pages/ProductDetailsPage";

import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { AccountPage } from "../pages/AccountPage";

import { CartPage } from "../pages/CartPage";
import { CheckoutPage } from "../pages/CheckoutPage";
import { CheckoutReturnPage } from "../pages/CheckoutReturnPage";

import { OrdersPage } from "../pages/OrdersPage";
import { OrderDetailsPage } from "../pages/OrderDetailsPage";

import { AdminDashboardPage } from "../pages/AdminDashboardPage";

import { NotFoundPage } from "../pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    element: <SiteLayout />,

    children: [
      {
        index: true,
        element: <HomePage />,
      },

      {
        path: "products",
        element: <ProductsPage />,
      },

      {
        path: "products/:slug",
        element: <ProductDetailsPage />,
      },

      {
        path: "login",
        element: <LoginPage />,
      },

      {
        path: "register",
        element: <RegisterPage />,
      },

      {
        path: "account",
        element: (
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        ),
      },

      {
        path: "cart",
        element: <CartPage />,
      },

      {
        path: "checkout",
        element: (
          <ProtectedRoute>
            <CheckoutPage />
          </ProtectedRoute>
        ),
      },

      {
        path: "checkout/success",
        element: <CheckoutReturnPage outcome="success" />,
      },

      {
        path: "checkout/cancel",
        element: <CheckoutReturnPage outcome="cancel" />,
      },

      {
        path: "orders",
        element: (
          <ProtectedRoute>
            <OrdersPage />
          </ProtectedRoute>
        ),
      },

      {
        path: "orders/:orderId",
        element: (
          <ProtectedRoute>
            <OrderDetailsPage />
          </ProtectedRoute>
        ),
      },

      // Admin role is checked in the dashboard for
      // appropriate UI and again by the Express API
      // for actual security enforcement.
      {
        path: "admin",
        element: (
          <ProtectedRoute>
            <AdminDashboardPage />
          </ProtectedRoute>
        ),
      },

      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
