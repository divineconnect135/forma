import { apiRequest } from "./http";

import type { CartItem } from "./cart";

export interface CheckoutPreview {
  data: {
    items: CartItem[];
    itemCount: number;
    subtotalCents: number;
    currency: "USD";
    shippingCents: null;
    taxCents: null;
    totalCents: null;
    requiresPayment: boolean;
  };
}

export interface CheckoutSessionResponse {
  data: {
    orderId: string;
    orderNumber: string;
    checkoutUrl: string;
    expiresAt: string;
  };
}

export type OrderStatus =
  "pending_payment" | "paid" | "cancelled" | "expired" | "refunded";

export interface CheckoutStatusResponse {
  data: {
    orderNumber: string;
    status: OrderStatus;
    reservationStatus: "none" | "active" | "released" | "committed";
    totalCents: number;
    currency: "USD";
    paidAt: string | null;
  };
}

export async function getCheckoutPreview(): Promise<CheckoutPreview> {
  return apiRequest<CheckoutPreview>("/api/checkout/preview");
}

export async function createCheckoutSession(
  idempotencyKey: string,
): Promise<CheckoutSessionResponse> {
  return apiRequest<CheckoutSessionResponse>("/api/checkout/session", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey,
    }),
  });
}

export async function getCheckoutStatus(
  sessionId: string,
): Promise<CheckoutStatusResponse> {
  return apiRequest<CheckoutStatusResponse>(
    `/api/checkout/status/${encodeURIComponent(sessionId)}`,
  );
}
