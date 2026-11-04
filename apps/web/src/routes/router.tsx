import { createBrowserRouter, Outlet } from "react-router";

import { ProtectedRoute } from "../components/ProtectedRoute";
import { RouteErrorPage } from "../components/RouteErrorPage";
import { SiteRoot } from "../components/SiteRoot";

import "../styles/accessibility.css";

function ProtectedPages() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  );
}

export const router = createBrowserRouter([
  {
    Component: SiteRoot,
    errorElement: <RouteErrorPage />,

    children: [
      // ------------------------------------
      // PUBLIC PAGES
      // ------------------------------------

      {
        index: true,
        lazy: async () => {
          const { HomePage } = await import("../pages/HomePage");

          return { Component: HomePage };
        },
      },

      {
        path: "products",
        lazy: async () => {
          const { ProductsPage } = await import("../pages/ProductsPage");

          return { Component: ProductsPage };
        },
      },

      {
        path: "products/:slug",
        lazy: async () => {
          const { ProductDetailsPage } =
            await import("../pages/ProductDetailsPage");

          return {
            Component: ProductDetailsPage,
          };
        },
      },

      {
        path: "login",
        lazy: async () => {
          const { LoginPage } = await import("../pages/LoginPage");

          return { Component: LoginPage };
        },
      },

      {
        path: "register",
        lazy: async () => {
          const { RegisterPage } = await import("../pages/RegisterPage");

          return { Component: RegisterPage };
        },
      },

      {
        path: "cart",
        lazy: async () => {
          const { CartPage } = await import("../pages/CartPage");

          return { Component: CartPage };
        },
      },

      // ------------------------------------
      // STRIPE RETURN PAGES
      // ------------------------------------

      {
        path: "checkout/success",
        lazy: async () => {
          const { CheckoutReturnPage } =
            await import("../pages/CheckoutReturnPage");

          function CheckoutSuccessRoute() {
            return <CheckoutReturnPage outcome="success" />;
          }

          return {
            Component: CheckoutSuccessRoute,
          };
        },
      },

      {
        path: "checkout/cancel",
        lazy: async () => {
          const { CheckoutReturnPage } =
            await import("../pages/CheckoutReturnPage");

          function CheckoutCancelRoute() {
            return <CheckoutReturnPage outcome="cancel" />;
          }

          return {
            Component: CheckoutCancelRoute,
          };
        },
      },

      // ------------------------------------
      // AUTHENTICATED CUSTOMER PAGES
      // ------------------------------------

      {
        Component: ProtectedPages,

        children: [
          {
            path: "account",
            lazy: async () => {
              const { AccountPage } = await import("../pages/AccountPage");

              return {
                Component: AccountPage,
              };
            },
          },

          {
            path: "checkout",
            lazy: async () => {
              const { CheckoutPage } = await import("../pages/CheckoutPage");

              return {
                Component: CheckoutPage,
              };
            },
          },

          {
            path: "orders",
            lazy: async () => {
              const { OrdersPage } = await import("../pages/OrdersPage");

              return {
                Component: OrdersPage,
              };
            },
          },

          {
            path: "orders/:orderId",
            lazy: async () => {
              const { OrderDetailsPage } =
                await import("../pages/OrderDetailsPage");

              return {
                Component: OrderDetailsPage,
              };
            },
          },

          // --------------------------------
          // ADMINISTRATION
          // --------------------------------

          {
            path: "admin",

            lazy: async () => {
              const { AdminLayout } = await import("../layouts/AdminLayout");

              return {
                Component: AdminLayout,
              };
            },

            children: [
              {
                index: true,
                lazy: async () => {
                  const { AdminDashboardPage } =
                    await import("../pages/AdminDashboardPage");

                  return {
                    Component: AdminDashboardPage,
                  };
                },
              },

              {
                path: "products",
                lazy: async () => {
                  const { AdminProductsPage } =
                    await import("../pages/AdminProductsPage");

                  return {
                    Component: AdminProductsPage,
                  };
                },
              },

              {
                path: "products/new",
                lazy: async () => {
                  const { AdminProductEditorPage } =
                    await import("../pages/AdminProductEditorPage");

                  return {
                    Component: AdminProductEditorPage,
                  };
                },
              },

              {
                path: "products/:productId",
                lazy: async () => {
                  const { AdminProductEditorPage } =
                    await import("../pages/AdminProductEditorPage");

                  return {
                    Component: AdminProductEditorPage,
                  };
                },
              },

              {
                path: "inventory",
                lazy: async () => {
                  const { AdminInventoryPage } =
                    await import("../pages/AdminInventoryPage");

                  return {
                    Component: AdminInventoryPage,
                  };
                },
              },

              {
                path: "orders",
                lazy: async () => {
                  const { AdminOrdersPage } =
                    await import("../pages/AdminOrdersPage");

                  return {
                    Component: AdminOrdersPage,
                  };
                },
              },

              {
                path: "orders/:orderId",
                lazy: async () => {
                  const { AdminOrderDetailsPage } =
                    await import("../pages/AdminOrderDetailsPage");

                  return {
                    Component: AdminOrderDetailsPage,
                  };
                },
              },

              {
                path: "customers",
                lazy: async () => {
                  const { AdminCustomersPage } =
                    await import("../pages/AdminCustomersPage");

                  return {
                    Component: AdminCustomersPage,
                  };
                },
              },

              {
                path: "audit",
                lazy: async () => {
                  const { AdminAuditPage } =
                    await import("../pages/AdminAuditPage");

                  return {
                    Component: AdminAuditPage,
                  };
                },
              },
            ],
          },
        ],
      },

      // ------------------------------------
      // NOT FOUND
      // ------------------------------------

      {
        path: "*",
        lazy: async () => {
          const { NotFoundPage } = await import("../pages/NotFoundPage");

          return {
            Component: NotFoundPage,
          };
        },
      },
    ],
  },
]);
