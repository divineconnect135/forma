import { randomBytes } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { Cart } from "../models/Cart.js";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
import { User } from "../models/User.js";
import { getCart } from "./cart.service.js";
import { recoverCheckoutOrder } from "./checkoutRecovery.service.js";
const RESERVATION_MINUTES = 35;
export class CheckoutError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = "CheckoutError";
    }
}
function duplicateKey(error) {
    return (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000);
}
export async function getCheckoutPreview(userId) {
    const result = await getCart(userId);
    const cart = result.data;
    if (cart.items.length === 0) {
        throw new CheckoutError(400, "EMPTY_CART", "Add products before checkout.");
    }
    if (cart.hasUnavailableItems) {
        throw new CheckoutError(409, "CART_ITEMS_UNAVAILABLE", "Some cart items are unavailable.");
    }
    if (!Number.isSafeInteger(cart.subtotalCents) || cart.subtotalCents <= 0) {
        throw new CheckoutError(400, "INVALID_SUBTOTAL", "Unable to calculate the subtotal.");
    }
    return {
        data: {
            items: cart.items,
            itemCount: cart.itemCount,
            subtotalCents: cart.subtotalCents,
            currency: "USD",
            shippingCents: null,
            taxCents: null,
            totalCents: null,
            requiresPayment: true,
        },
    };
}
export async function startCheckout(userId, idempotencyKey) {
    if (!Types.ObjectId.isValid(userId)) {
        throw new CheckoutError(401, "UNAUTHENTICATED", "Invalid customer session.");
    }
    const customerId = new Types.ObjectId(userId);
    const customer = await User.findOne({
        _id: customerId,
        active: true,
    })
        .select("email")
        .lean();
    if (!customer) {
        throw new CheckoutError(401, "UNAUTHENTICATED", "Customer account unavailable.");
    }
    // Ensure the unique indexes are available before
    // creating concurrent pending orders.
    await Order.init();
    let order;
    try {
        order = await mongoose.connection.transaction(async (session) => {
            const previous = await Order.findOne({
                userId: customerId,
                idempotencyKey,
            }).session(session);
            if (previous) {
                if (previous.status !== "pending_payment") {
                    throw new CheckoutError(409, "CHECKOUT_ALREADY_USED", "This checkout attempt has ended.");
                }
                return previous;
            }
            const active = await Order.findOne({
                userId: customerId,
                status: "pending_payment",
            }).session(session);
            if (active) {
                throw new CheckoutError(409, "ACTIVE_CHECKOUT_EXISTS", "You already have an unfinished checkout. Continue or cancel it from your orders.");
            }
            const cart = await Cart.findOne({
                userId: customerId,
            }).session(session);
            if (!cart || cart.items.length === 0) {
                throw new CheckoutError(400, "EMPTY_CART", "Your cart is empty.");
            }
            const orderItems = [];
            let subtotalCents = 0;
            for (const item of cart.items) {
                const quantity = item.quantity;
                if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
                    throw new CheckoutError(400, "INVALID_QUANTITY", "Invalid cart item quantity.");
                }
                // Atomically reserve stock only when
                // enough unreserved units remain.
                const variant = await ProductVariant.findOneAndUpdate({
                    _id: item.variantId,
                    active: true,
                    $expr: {
                        $gte: [
                            {
                                $subtract: ["$stockOnHand", "$stockReserved"],
                            },
                            quantity,
                        ],
                    },
                }, {
                    $inc: {
                        stockReserved: quantity,
                    },
                }, {
                    new: true,
                    session,
                });
                if (!variant) {
                    throw new CheckoutError(409, "INSUFFICIENT_STOCK", "A cart variant is unavailable or has insufficient stock.");
                }
                const product = await Product.findOne({
                    _id: variant.productId,
                    status: "active",
                }).session(session);
                if (!product) {
                    throw new CheckoutError(409, "PRODUCT_UNAVAILABLE", "A selected product is unavailable.");
                }
                const price = product.priceCents;
                if (!Number.isSafeInteger(price) || price <= 0) {
                    throw new CheckoutError(400, "INVALID_PRODUCT_PRICE", "A product has an invalid price.");
                }
                const lineTotal = price * quantity;
                if (!Number.isSafeInteger(lineTotal)) {
                    throw new CheckoutError(400, "INVALID_ORDER_TOTAL", "Order total exceeds allowed limits.");
                }
                subtotalCents += lineTotal;
                if (!Number.isSafeInteger(subtotalCents)) {
                    throw new CheckoutError(400, "INVALID_ORDER_TOTAL", "Order total exceeds allowed limits.");
                }
                orderItems.push({
                    productId: product._id,
                    variantId: variant._id,
                    productName: product.name,
                    productSlug: product.slug,
                    sku: variant.sku,
                    color: variant.color,
                    size: variant.size ?? null,
                    quantity,
                    unitPriceCents: price,
                    lineTotalCents: lineTotal,
                });
            }
            const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);
            const order = new Order({
                orderNumber: "FM-" + randomBytes(8).toString("hex").toUpperCase(),
                userId: customerId,
                items: orderItems,
                currency: "USD",
                subtotalCents,
                shippingCents: 0,
                taxCents: 0,
                totalCents: subtotalCents,
                status: "pending_payment",
                reservationStatus: "active",
                reservationExpiresAt: expiresAt,
                idempotencyKey,
            });
            await order.save({ session });
            return order;
        });
    }
    catch (error) {
        if (!duplicateKey(error)) {
            throw error;
        }
        // Concurrent retries may hit a unique index.
        // A matching key can reuse the original order.
        const previous = await Order.findOne({
            userId: customerId,
            idempotencyKey,
        });
        if (previous && previous.status === "pending_payment") {
            order = previous;
        }
        else {
            throw new CheckoutError(409, "ACTIVE_CHECKOUT_EXISTS", "Another checkout is already active.");
        }
    }
    // The MongoDB transaction commits BEFORE
    // any external Stripe network request.
    //
    // Recovery uses the saved order snapshot and
    // never increases reservations on retries.
    return recoverCheckoutOrder(order);
}
