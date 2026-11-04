import { apiRequest } from "./http";

export interface CartEntry {
  variantId: string;
  quantity: number;
}

export interface CartItem extends CartEntry {
  productSlug: string | null;
  productName: string;
  sku: string | null;
  color: string | null;
  size: string | null;
  imageUrl: string | null;
  unitPriceCents: number;
  availableQuantity: number;
  canPurchase: boolean;
}

export interface CartResponse {
  data: {
    items: CartItem[];
    itemCount: number;
    subtotalCents: number;
    currency: "USD";
    hasUnavailableItems: boolean;
  };
}

export async function getServerCart() {
  return apiRequest<CartResponse>("/api/cart");
}

export async function previewGuestCart(items: CartEntry[]) {
  return apiRequest<CartResponse>("/api/cart/preview", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export async function addServerCartItem(variantId: string, quantity: number) {
  return apiRequest<CartResponse>("/api/cart/items", {
    method: "POST",
    body: JSON.stringify({
      variantId,
      quantity,
    }),
  });
}

export async function updateServerCartItem(
  variantId: string,
  quantity: number,
) {
  return apiRequest<CartResponse>(
    `/api/cart/items/${encodeURIComponent(variantId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    },
  );
}

export async function removeServerCartItem(variantId: string) {
  return apiRequest<CartResponse>(
    `/api/cart/items/${encodeURIComponent(variantId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function mergeServerCart(mergeId: string, items: CartEntry[]) {
  return apiRequest<CartResponse>("/api/cart/merge", {
    method: "POST",
    body: JSON.stringify({
      mergeId,
      items,
    }),
  });
}
