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

export type CheckoutRecoveryState = "ready" | "paid" | "expired" | "pending";

export interface CheckoutSessionResponse {
  data: {
    orderId: string;
    orderNumber: string;
    checkoutUrl: string | null;
    expiresAt: string;
    state: CheckoutRecoveryState;
  };
}

export interface ActiveCheckoutResponse {
  data: {
    orderId: string;
    orderNumber: string;
    expiresAt: string | null;
  } | null;
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

export function getCheckoutPreview() {
  return apiRequest<CheckoutPreview>("/api/checkout/preview");
}

export function getActiveCheckout() {
  return apiRequest<ActiveCheckoutResponse>("/api/checkout/active");
}

export function createCheckoutSession(idempotencyKey: string) {
  return apiRequest<CheckoutSessionResponse>("/api/checkout/session", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey,
    }),
  });
}

export function resumeCheckoutSession() {
  return apiRequest<CheckoutSessionResponse>("/api/checkout/resume", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getCheckoutStatus(sessionId: string) {
  return apiRequest<CheckoutStatusResponse>(
    `/api/checkout/status/${encodeURIComponent(sessionId)}`,
  );
}
