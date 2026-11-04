import { apiRequest } from "./http";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PageResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface DataResponse<T> {
  data: T;
}

export type PaymentStatus =
  "pending_payment" | "paid" | "cancelled" | "expired" | "refunded";

export type FulfillmentStatus =
  "unfulfilled" | "processing" | "shipped" | "delivered";

export interface AdminRecentOrder {
  id: string;
  orderNumber: string;
  status: PaymentStatus;
  totalCents: number;
  currency: "USD";
  createdAt: string;
}

export interface AdminOverviewResponse {
  data: {
    products: {
      total: number;
      active: number;
    };
    inventory: {
      activeVariants: number;
      lowStockVariants: number;
      outOfStockVariants: number;
    };
    orders: {
      total: number;
      pending: number;
      paid: number;
    };
    customers: {
      total: number;
    };
    paidSales: {
      currency: "USD";
      grossCents: number;
      testMode: true;
    };
    recentOrders: AdminRecentOrder[];
  };
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  priceCents: number;
  currency: "USD";
  status: "active" | "archived";
  featured: boolean;
  images: string[];
  modelUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVariant {
  id: string;
  productId: string;
  sku: string;
  color: string;
  size: string | null;
  active: boolean;
  stockOnHand: number;
  stockReserved: number;
  availableQuantity: number;
}

export interface AdminProductDetail extends AdminProduct {
  variants: AdminVariant[];
}

export interface AdminInventoryVariant extends AdminVariant {
  productName: string;
  productSlug: string;
}

export interface ProductInput {
  name: string;
  slug: string;
  description: string;
  category: string;
  priceCents: number;
  featured: boolean;
  images: string[];
  modelUrl: string | null;
  status: "active" | "archived";
}

export interface VariantInput {
  sku: string;
  color: string;
  size: string | null;
}

export interface AdminOrderSummary {
  id: string;
  orderNumber: string;
  status: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  totalCents: number;
  currency: "USD";
  createdAt: string;
}

export interface AdminOrderItem {
  productName: string;
  sku: string;
  color: string;
  size: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  fulfillmentUpdatedAt: string | null;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  items: AdminOrderItem[];
  customer: {
    name: string;
    email: string;
  } | null;
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: string;
}

export interface AdminAuditRecord {
  id: string;
  actorId: string;
  action: string;
  resourceType: "product" | "variant" | "order";
  resourceId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function pageUrl(
  path: string,
  page: number,
  extras: Record<string, string> = {},
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...extras,
  });

  return `${path}?${params.toString()}`;
}

function jsonRequest<T>(path: string, method: "POST" | "PATCH", body: unknown) {
  return apiRequest<T>(path, {
    method,
    body: JSON.stringify(body),
  });
}

export function getAdminOverview() {
  return apiRequest<AdminOverviewResponse>("/api/admin/overview");
}

// Products
export function getAdminProducts(page = 1) {
  return apiRequest<PageResponse<AdminProduct>>(
    pageUrl("/api/admin/products", page),
  );
}

export function getAdminProduct(productId: string) {
  return apiRequest<DataResponse<AdminProductDetail>>(
    `/api/admin/products/${encodeURIComponent(productId)}`,
  );
}

export function createAdminProduct(input: ProductInput) {
  return jsonRequest<DataResponse<AdminProduct>>(
    "/api/admin/products",
    "POST",
    input,
  );
}

export function updateAdminProduct(
  productId: string,
  input: Partial<ProductInput>,
) {
  return jsonRequest<DataResponse<AdminProduct>>(
    `/api/admin/products/${encodeURIComponent(productId)}`,
    "PATCH",
    input,
  );
}

export function archiveAdminProduct(productId: string) {
  return jsonRequest<DataResponse<AdminProduct>>(
    `/api/admin/products/${encodeURIComponent(productId)}/archive`,
    "POST",
    {},
  );
}

// Variants
export function createAdminVariant(productId: string, input: VariantInput) {
  return jsonRequest<DataResponse<AdminVariant>>(
    `/api/admin/products/${encodeURIComponent(productId)}/variants`,
    "POST",
    input,
  );
}

export function updateAdminVariant(
  variantId: string,
  input: Partial<Pick<AdminVariant, "color" | "size" | "active">>,
) {
  return jsonRequest<DataResponse<AdminVariant>>(
    `/api/admin/variants/${encodeURIComponent(variantId)}`,
    "PATCH",
    input,
  );
}

// Inventory
export function getAdminInventory(
  page = 1,
  stock: "all" | "low" | "out" = "all",
) {
  return apiRequest<PageResponse<AdminInventoryVariant>>(
    pageUrl("/api/admin/inventory", page, { stock }),
  );
}

export function adjustAdminStock(
  variantId: string,
  delta: number,
  reason: string,
) {
  return jsonRequest<DataResponse<AdminVariant>>(
    `/api/admin/variants/${encodeURIComponent(variantId)}/adjust-stock`,
    "POST",
    { delta, reason },
  );
}

// Orders
export function getAdminOrders(
  page = 1,
  status: PaymentStatus | "all" = "all",
) {
  return apiRequest<PageResponse<AdminOrderSummary>>(
    pageUrl("/api/admin/orders", page, { status }),
  );
}

export function getAdminOrder(orderId: string) {
  return apiRequest<DataResponse<AdminOrderDetail>>(
    `/api/admin/orders/${encodeURIComponent(orderId)}`,
  );
}

export function updateAdminFulfillment(
  orderId: string,
  status: Exclude<FulfillmentStatus, "unfulfilled">,
) {
  return jsonRequest<DataResponse<AdminOrderDetail>>(
    `/api/admin/orders/${encodeURIComponent(orderId)}/fulfillment`,
    "PATCH",
    { status },
  );
}

// Customers
export function getAdminCustomers(page = 1) {
  return apiRequest<PageResponse<AdminCustomer>>(
    pageUrl("/api/admin/customers", page),
  );
}

// Audit history
export function getAdminAudit(page = 1) {
  return apiRequest<PageResponse<AdminAuditRecord>>(
    pageUrl("/api/admin/audit", page),
  );
}
