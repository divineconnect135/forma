import { User } from "../models/User.js";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
import { Order } from "../models/Order.js";

interface InventorySummary {
  activeVariants: number;
  lowStockVariants: number;
  outOfStockVariants: number;
}

interface PaidSalesSummary {
  paidOrders: number;
  grossCents: number;
}

export async function getAdminOverview() {
  const [
    totalProducts,
    activeProducts,
    totalOrders,
    pendingOrders,
    totalCustomers,
    inventoryResults,
    paidSalesResults,
    recentOrders,
  ] = await Promise.all([
    Product.countDocuments(),

    Product.countDocuments({
      status: "active",
    }),

    Order.countDocuments(),

    Order.countDocuments({
      status: "pending_payment",
    }),

    User.countDocuments({
      role: "customer",
      active: true,
    }),

    ProductVariant.aggregate<InventorySummary>([
      {
        $match: {
          active: true,
        },
      },
      {
        $project: {
          available: {
            $subtract: ["$stockOnHand", "$stockReserved"],
          },
        },
      },
      {
        $group: {
          _id: null,
          activeVariants: {
            $sum: 1,
          },
          lowStockVariants: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$available", 0] },
                    { $lte: ["$available", 5] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          outOfStockVariants: {
            $sum: {
              $cond: [{ $lte: ["$available", 0] }, 1, 0],
            },
          },
        },
      },
    ]),

    Order.aggregate<PaidSalesSummary>([
      {
        $match: {
          status: "paid",
        },
      },
      {
        $group: {
          _id: null,
          paidOrders: {
            $sum: 1,
          },
          grossCents: {
            $sum: "$totalCents",
          },
        },
      },
    ]),

    Order.find()
      .sort({ createdAt: -1, _id: -1 })
      .limit(8)
      .select("orderNumber status totalCents currency createdAt")
      .lean(),
  ]);

  const inventory = inventoryResults[0] ?? {
    activeVariants: 0,
    lowStockVariants: 0,
    outOfStockVariants: 0,
  };

  const paidSales = paidSalesResults[0] ?? {
    paidOrders: 0,
    grossCents: 0,
  };

  return {
    data: {
      products: {
        total: totalProducts,
        active: activeProducts,
      },

      inventory: {
        activeVariants: inventory.activeVariants,
        lowStockVariants: inventory.lowStockVariants,
        outOfStockVariants: inventory.outOfStockVariants,
      },

      orders: {
        total: totalOrders,
        pending: pendingOrders,
        paid: paidSales.paidOrders,
      },

      customers: {
        total: totalCustomers,
      },

      paidSales: {
        currency: "USD" as const,
        grossCents: paidSales.grossCents,
        testMode: true,
      },

      recentOrders: recentOrders.map((order) => ({
        id: String(order._id),
        orderNumber: order.orderNumber,
        status: order.status,
        totalCents: order.totalCents,
        currency: order.currency,
        createdAt: order.createdAt,
      })),
    },
  };
}
