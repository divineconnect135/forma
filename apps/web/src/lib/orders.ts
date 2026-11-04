import { apiRequest } from "./http";

export type OrderStatus =
  "pending_payment" | "paid" | "cancelled" | "expired" | "refunded";

export type ReservationStatus = "none" | "active" | "released" | "committed";

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  reservationStatus: ReservationStatus;
  currency: "USD";
  itemCount: number;
  totalCents: number;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  variantId: string;
  productName: string;
  productSlug: string;
  sku: string;
  color: string;
  size: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface OrderDetails extends OrderSummary {
  items: OrderItem[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  reservationExpiresAt: string | null;
  paidAt: string | null;
  canCancel: boolean;
}

export interface OrderListResponse {
  data: OrderSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface OrderDetailsResponse {
  data: OrderDetails;
}

export async function getOrders(page = 1): Promise<OrderListResponse> {
  return apiRequest<OrderListResponse>(`/api/orders?page=${page}&limit=10`);
}

export async function getOrderDetails(
  orderId: string,
): Promise<OrderDetailsResponse> {
  return apiRequest<OrderDetailsResponse>(
    `/api/orders/${encodeURIComponent(orderId)}`,
  );
}

export async function cancelPendingCheckout(
  orderId: string,
): Promise<OrderDetailsResponse> {
  return apiRequest<OrderDetailsResponse>(
    `/api/orders/${encodeURIComponent(orderId)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export function getOrderStatusLabel(status: OrderStatus) {
  switch (status) {
    case "pending_payment":
      return "Pending payment";
    case "paid":
      return "Paid";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    case "refunded":
      return "Refunded";
  }
}
