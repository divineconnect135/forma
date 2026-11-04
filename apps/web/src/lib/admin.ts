import { apiRequest } from "./http";

export interface AdminRecentOrder {
  id: string;
  orderNumber: string;
  status: "pending_payment" | "paid" | "cancelled" | "expired" | "refunded";
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

export async function getAdminOverview(): Promise<AdminOverviewResponse> {
  return apiRequest<AdminOverviewResponse>("/api/admin/overview");
}
