import mongoose, { Types } from "mongoose";

import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { AdminAudit } from "../models/AdminAudit.js";

import type {
  CreateAdminProduct,
  UpdateAdminProduct,
  CreateAdminVariant,
  UpdateAdminVariant,
  StockAdjustment,
  FulfillmentUpdate,
} from "../validators/admin.js";

// Keep order queries compatible with the exact
// status union declared by the Mongoose model.
type OrderPaymentStatus = InstanceType<typeof Order>["status"];

export class AdminManagementError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AdminManagementError";
  }
}

// ----------------------------------------------
// HELPERS
// ----------------------------------------------

function id(value: string): Types.ObjectId {
  if (!/^[a-fA-F0-9]{24}$/.test(value)) {
    throw new AdminManagementError(400, "INVALID_ID", "Invalid resource ID");
  }

  return new Types.ObjectId(value);
}

function duplicateError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

function pageResult<T>(data: T[], page: number, limit: number, total: number) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function audit(
  actorId: string,
  action: string,
  resourceType: "product" | "variant" | "order",
  resourceId: Types.ObjectId,
  metadata: Record<string, unknown>,
  session: mongoose.ClientSession,
) {
  await AdminAudit.create(
    [
      {
        actorId: id(actorId),
        action,
        resourceType,
        resourceId,
        metadata,
      },
    ],
    { session },
  );
}

function productDto(product: InstanceType<typeof Product>) {
  return {
    id: String(product._id),
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: product.category,
    priceCents: product.priceCents,
    currency: product.currency,
    status: product.status,
    featured: product.featured,
    images: product.images,
    modelUrl: product.modelUrl ?? null,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function variantDto(variant: InstanceType<typeof ProductVariant>) {
  return {
    id: String(variant._id),
    productId: String(variant.productId),
    sku: variant.sku,
    color: variant.color,
    size: variant.size ?? null,
    active: variant.active,
    stockOnHand: variant.stockOnHand,
    stockReserved: variant.stockReserved,
    availableQuantity: variant.stockOnHand - variant.stockReserved,
  };
}

// ==============================================
// PRODUCT MANAGEMENT
// ==============================================

export async function listAdminProducts(page: number, limit: number) {
  const [total, products] = await Promise.all([
    Product.countDocuments(),

    Product.find()
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  return pageResult(products.map(productDto), page, limit, total);
}

export async function getAdminProduct(productId: string) {
  const product = await Product.findById(id(productId));

  if (!product) {
    throw new AdminManagementError(
      404,
      "PRODUCT_NOT_FOUND",
      "Product not found",
    );
  }

  const variants = await ProductVariant.find({
    productId: product._id,
  }).sort({
    sku: 1,
  });

  return {
    data: {
      ...productDto(product),
      variants: variants.map(variantDto),
    },
  };
}

// FIXED: Create a Mongoose document directly
// instead of using Product.create([...], { session }).
export async function createAdminProduct(
  actorId: string,
  input: CreateAdminProduct,
) {
  await AdminAudit.init();

  try {
    return await mongoose.connection.transaction(async (session) => {
      const product = new Product({
        ...input,
        currency: "USD",
      });

      // Save the document in the transaction.
      await product.save({ session });

      // Audit and product creation commit together.
      await audit(
        actorId,
        "product.created",
        "product",
        product._id,
        {
          slug: product.slug,
          priceCents: product.priceCents,
        },
        session,
      );

      return {
        data: productDto(product),
      };
    });
  } catch (error) {
    if (duplicateError(error)) {
      throw new AdminManagementError(
        409,
        "PRODUCT_CONFLICT",
        "Product slug already exists",
      );
    }

    throw error;
  }
}

export async function updateAdminProduct(
  actorId: string,
  productId: string,
  changes: UpdateAdminProduct,
) {
  try {
    return await mongoose.connection.transaction(async (session) => {
      const product = await Product.findById(id(productId)).session(session);

      if (!product) {
        throw new AdminManagementError(
          404,
          "PRODUCT_NOT_FOUND",
          "Product not found",
        );
      }

      product.set(changes);

      await product.save({ session });

      await audit(
        actorId,
        "product.updated",
        "product",
        product._id,
        {
          slug: product.slug,
          fields: Object.keys(changes),
        },
        session,
      );

      return {
        data: productDto(product),
      };
    });
  } catch (error) {
    if (duplicateError(error)) {
      throw new AdminManagementError(
        409,
        "PRODUCT_CONFLICT",
        "Product slug already exists",
      );
    }

    throw error;
  }
}

export async function archiveAdminProduct(actorId: string, productId: string) {
  return updateAdminProduct(actorId, productId, {
    status: "archived",
  });
}

// ==============================================
// PRODUCT VARIANT MANAGEMENT
// ==============================================

// FIXED: Use new ProductVariant().save()
// instead of the array-based create overload.
export async function createAdminVariant(
  actorId: string,
  productId: string,
  input: CreateAdminVariant,
) {
  await AdminAudit.init();

  try {
    return await mongoose.connection.transaction(async (session) => {
      const product = await Product.findById(id(productId)).session(session);

      if (!product) {
        throw new AdminManagementError(
          404,
          "PRODUCT_NOT_FOUND",
          "Product not found",
        );
      }

      const variant = new ProductVariant({
        productId: product._id,
        sku: input.sku,
        color: input.color,
        size: input.size,
        stockOnHand: 0,
        stockReserved: 0,
        active: true,
      });

      await variant.save({ session });

      await audit(
        actorId,
        "variant.created",
        "variant",
        variant._id,
        {
          sku: variant.sku,
        },
        session,
      );

      return {
        data: variantDto(variant),
      };
    });
  } catch (error) {
    if (duplicateError(error)) {
      throw new AdminManagementError(
        409,
        "VARIANT_CONFLICT",
        "SKU already exists",
      );
    }

    throw error;
  }
}

export async function updateAdminVariant(
  actorId: string,
  variantId: string,
  changes: UpdateAdminVariant,
) {
  return mongoose.connection.transaction(async (session) => {
    const variant = await ProductVariant.findById(id(variantId)).session(
      session,
    );

    if (!variant) {
      throw new AdminManagementError(
        404,
        "VARIANT_NOT_FOUND",
        "Variant not found",
      );
    }

    // Prevent deactivation while inventory
    // is reserved for pending checkout orders.
    if (changes.active === false && variant.stockReserved > 0) {
      throw new AdminManagementError(
        409,
        "ACTIVE_RESERVATIONS",
        "Cannot deactivate a variant with reserved stock",
      );
    }

    variant.set(changes);

    await variant.save({ session });

    await audit(
      actorId,
      "variant.updated",
      "variant",
      variant._id,
      {
        sku: variant.sku,
        fields: Object.keys(changes),
      },
      session,
    );

    return {
      data: variantDto(variant),
    };
  });
}

// ==============================================
// INVENTORY MANAGEMENT
// ==============================================

export async function adjustAdminStock(
  actorId: string,
  variantId: string,
  input: StockAdjustment,
) {
  return mongoose.connection.transaction(async (session) => {
    const variantObjectId = id(variantId);

    // Atomic stock update.
    //
    // The resulting stock must never be lower
    // than the number of reserved units.
    const variant = await ProductVariant.findOneAndUpdate(
      {
        _id: variantObjectId,

        $expr: {
          $and: [
            {
              $gte: [
                {
                  $add: ["$stockOnHand", input.delta],
                },
                "$stockReserved",
              ],
            },

            {
              $lte: [
                {
                  $add: ["$stockOnHand", input.delta],
                },
                10_000_000,
              ],
            },
          ],
        },
      },

      {
        $inc: {
          stockOnHand: input.delta,
        },
      },

      {
        new: true,
        session,
      },
    );

    if (!variant) {
      throw new AdminManagementError(
        409,
        "STOCK_ADJUSTMENT_REJECTED",
        "Variant missing, stock limit exceeded, or stock is reserved",
      );
    }

    await audit(
      actorId,
      "inventory.adjusted",
      "variant",
      variant._id,
      {
        sku: variant.sku,
        delta: input.delta,
        reason: input.reason,
        stockOnHandAfter: variant.stockOnHand,
        stockReserved: variant.stockReserved,
      },
      session,
    );

    return {
      data: variantDto(variant),
    };
  });
}

export async function listAdminInventory(
  page: number,
  limit: number,
  stock: "all" | "low" | "out",
) {
  const available = {
    $subtract: ["$stockOnHand", "$stockReserved"],
  };

  const filter: Record<string, unknown> = {};

  if (stock === "low") {
    filter.active = true;

    filter.$expr = {
      $and: [
        {
          $gt: [available, 0],
        },
        {
          $lte: [available, 5],
        },
      ],
    };
  }

  if (stock === "out") {
    filter.active = true;

    filter.$expr = {
      $lte: [available, 0],
    };
  }

  const [total, variants] = await Promise.all([
    ProductVariant.countDocuments(filter),

    ProductVariant.find(filter)
      .sort({
        sku: 1,
        _id: 1,
      })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  const products = await Product.find({
    _id: {
      $in: variants.map((variant) => variant.productId),
    },
  }).select("name slug");

  const productMap = new Map(
    products.map((product) => [
      String(product._id),
      {
        name: product.name,
        slug: product.slug,
      },
    ]),
  );

  const data = variants.map((variant) => {
    const product = productMap.get(String(variant.productId));

    return {
      ...variantDto(variant),
      productName: product?.name ?? "Unknown product",
      productSlug: product?.slug ?? "",
    };
  });

  return pageResult(data, page, limit, total);
}

// ==============================================
// ORDER MANAGEMENT
// ==============================================

function orderDto(order: InstanceType<typeof Order>) {
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    status: order.status,
    fulfillmentStatus: order.fulfillmentStatus,
    totalCents: order.totalCents,
    currency: order.currency,
    createdAt: order.createdAt,

    fulfillmentUpdatedAt: order.fulfillmentUpdatedAt ?? null,

    items: order.items.map((item) => ({
      productName: item.productName,
      sku: item.sku,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
    })),
  };
}

export async function listAdminOrders(
  page: number,
  limit: number,
  status: OrderPaymentStatus | "all",
) {
  // Preserve the exact payment status union.
  const filter: {
    status?: OrderPaymentStatus;
  } =
    status === "all"
      ? {}
      : {
          status,
        };

  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),

    Order.find(filter)
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  return pageResult(
    orders.map((order) => {
      const dto = orderDto(order);

      return {
        id: dto.id,
        orderNumber: dto.orderNumber,
        status: dto.status,
        fulfillmentStatus: dto.fulfillmentStatus,
        totalCents: dto.totalCents,
        currency: dto.currency,
        createdAt: dto.createdAt,
      };
    }),
    page,
    limit,
    total,
  );
}

export async function getAdminOrder(orderId: string) {
  const order = await Order.findById(id(orderId));

  if (!order) {
    throw new AdminManagementError(404, "ORDER_NOT_FOUND", "Order not found");
  }

  const buyer = await User.findById(order.userId).select("name email").lean();

  return {
    data: {
      ...orderDto(order),
      subtotalCents: order.subtotalCents,
      taxCents: order.taxCents,
      shippingCents: order.shippingCents,

      customer: buyer
        ? {
            name: buyer.name,
            email: buyer.email,
          }
        : null,
    },
  };
}

const nextFulfillment: Record<string, string> = {
  unfulfilled: "processing",
  processing: "shipped",
  shipped: "delivered",
};

export async function updateAdminFulfillment(
  actorId: string,
  orderId: string,
  input: FulfillmentUpdate,
) {
  return mongoose.connection.transaction(async (session) => {
    const order = await Order.findById(id(orderId)).session(session);

    if (!order) {
      throw new AdminManagementError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    // Admin fulfillment must never mark
    // a pending checkout as paid.
    if (order.status !== "paid") {
      throw new AdminManagementError(
        409,
        "PAYMENT_NOT_CONFIRMED",
        "Only verified paid orders can be fulfilled",
      );
    }

    const current = order.fulfillmentStatus ?? "unfulfilled";

    if (nextFulfillment[current] !== input.status) {
      throw new AdminManagementError(
        409,
        "INVALID_FULFILLMENT_TRANSITION",
        "Fulfillment must move from unfulfilled to processing, shipped, then delivered",
      );
    }

    order.fulfillmentStatus = input.status;
    order.fulfillmentUpdatedAt = new Date();

    await order.save({ session });

    await audit(
      actorId,
      "order.fulfillment_updated",
      "order",
      order._id,
      {
        orderNumber: order.orderNumber,
        from: current,
        to: input.status,
      },
      session,
    );

    return {
      data: orderDto(order),
    };
  });
}

// ==============================================
// CUSTOMER MANAGEMENT
// ==============================================

export async function listAdminCustomers(page: number, limit: number) {
  // Keep "customer" as a literal type,
  // not a generic string.
  const filter = {
    role: "customer",
  } as const;

  const [total, customers] = await Promise.all([
    User.countDocuments(filter),

    User.find(filter)
      .select("name email active createdAt")
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  return pageResult(
    customers.map((customer) => ({
      id: String(customer._id),
      name: customer.name,
      email: customer.email,
      active: customer.active,
      createdAt: customer.createdAt,
    })),
    page,
    limit,
    total,
  );
}

// ==============================================
// AUDIT HISTORY
// ==============================================

export async function listAdminAudit(page: number, limit: number) {
  const [total, records] = await Promise.all([
    AdminAudit.countDocuments(),

    AdminAudit.find()
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return pageResult(
    records.map((record) => ({
      id: String(record._id),
      actorId: String(record.actorId),
      action: record.action,
      resourceType: record.resourceType,
      resourceId: String(record.resourceId),
      metadata: record.metadata,
      createdAt: record.createdAt,
    })),
    page,
    limit,
    total,
  );
}
