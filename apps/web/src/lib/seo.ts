export interface PageSeoData {
  title: string;
  description: string;
  indexable: boolean;
  canonicalPath: string | null;
}

const STORE_DESCRIPTION =
  "Discover modern furniture, lighting, and design-led home essentials with Forma.";

function publicPage(
  title: string,
  description: string,
  canonicalPath: string,
): PageSeoData {
  return {
    title,
    description,
    indexable: true,
    canonicalPath,
  };
}

function privatePage(title: string): PageSeoData {
  return {
    title: `${title} | Forma`,
    description: "Private customer or administrator area.",
    indexable: false,
    canonicalPath: null,
  };
}

export function getPageSeo(pathname: string): PageSeoData {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === "/") {
    return publicPage(
      "Forma | Modern Furniture and Lighting",
      STORE_DESCRIPTION,
      "/",
    );
  }

  if (path === "/products") {
    return publicPage(
      "Shop Furniture and Lighting | Forma",
      "Browse furniture, lighting, and home accessories from the Forma collection.",
      "/products",
    );
  }

  if (/^\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)) {
    return publicPage(
      "Product Details | Forma",
      "Explore product details, available finishes, and design features from Forma.",
      path,
    );
  }

  if (path === "/login" || path === "/register") {
    return privatePage("Sign In or Register");
  }

  if (path === "/account" || path.startsWith("/account/")) {
    return privatePage("My Account");
  }

  if (path === "/cart" || path.startsWith("/cart/")) {
    return privatePage("Shopping Cart");
  }

  if (path === "/checkout" || path.startsWith("/checkout/")) {
    return privatePage("Checkout");
  }

  if (path === "/orders" || path.startsWith("/orders/")) {
    return privatePage("My Orders");
  }

  if (path === "/admin" || path.startsWith("/admin/")) {
    return privatePage("Administration");
  }

  return {
    title: "Page Not Found | Forma",
    description: "The requested page could not be found.",
    indexable: false,
    canonicalPath: null,
  };
}
