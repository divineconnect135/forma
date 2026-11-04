import { Types } from "mongoose";
import { Order } from "../models/Order.js";
import { expireStripeSession, retrieveStripeSession, } from "./stripe.service.js";
import { settleStripeSession } from "./orderSettlement.service.js";
export class OrderError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = "OrderError";
    }
}
function toOrderSummary(order) {
    return {
        id: String(order._id),
        orderNumber: order.orderNumber,
        status: order.status,
        reservationStatus: order.reservationStatus,
        currency: order.currency,
        itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
        totalCents: order.totalCents,
        createdAt: order.createdAt,
    };
}
function toOrderDetails(order) {
    return {
        ...toOrderSummary(order),
        items: order.items.map((item) => ({
            productId: String(item.productId),
            variantId: String(item.variantId),
            productName: item.productName,
            productSlug: item.productSlug,
            sku: item.sku,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            lineTotalCents: item.lineTotalCents,
        })),
        subtotalCents: order.subtotalCents,
        shippingCents: order.shippingCents,
        taxCents: order.taxCents,
        totalCents: order.totalCents,
        reservationExpiresAt: order.reservationExpiresAt,
        paidAt: order.paidAt,
        canCancel: order.status === "pending_payment" &&
            order.reservationStatus === "active" &&
            Boolean(order.stripeCheckoutSessionId),
    };
}
export async function listCustomerOrders(userId, page, limit) {
    const filter = {
        userId: new Types.ObjectId(userId),
    };
    const [orders, total] = await Promise.all([
        Order.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Order.countDocuments(filter),
    ]);
    return {
        data: orders.map(toOrderSummary),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
async function findCustomerOrder(userId, orderId) {
    if (!Types.ObjectId.isValid(orderId)) {
        throw new OrderError(400, "INVALID_ORDER_ID", "Invalid order ID");
    }
    const order = await Order.findOne({
        _id: new Types.ObjectId(orderId),
        userId: new Types.ObjectId(userId),
    });
    if (!order) {
        throw new OrderError(404, "ORDER_NOT_FOUND", "Order not found");
    }
    return order;
}
export async function getCustomerOrder(userId, orderId) {
    const order = await findCustomerOrder(userId, orderId);
    return {
        data: toOrderDetails(order),
    };
}
export async function cancelCustomerCheckout(userId, orderId) {
    const order = await findCustomerOrder(userId, orderId);
    if (order.status !== "pending_payment" ||
        order.reservationStatus !== "active") {
        throw new OrderError(409, "ORDER_NOT_CANCELLABLE", "This order cannot be cancelled through checkout");
    }
    const sessionId = order.stripeCheckoutSessionId;
    if (!sessionId) {
        throw new OrderError(409, "CHECKOUT_REQUIRES_REVIEW", "This checkout needs payment reconciliation");
    }
    // Never release stock based only on a button click.
    // Always ask Stripe for the actual session state.
    let checkout;
    try {
        checkout = await retrieveStripeSession(sessionId);
        if (checkout.status === "open") {
            try {
                checkout = await expireStripeSession(sessionId);
            }
            catch {
                // Stripe may have completed or expired
                // the checkout while we were cancelling.
                checkout = await retrieveStripeSession(sessionId);
            }
        }
    }
    catch {
        throw new OrderError(502, "STRIPE_UNAVAILABLE", "Unable to verify the current Stripe checkout status");
    }
    // The settlement service validates the payment
    // amount, order identity, and inventory state.
    // It also handles simultaneous webhook delivery.
    const outcome = await settleStripeSession(checkout, "reconciliation");
    // If another process settled the order,
    // reread it rather than guessing the outcome.
    const updated = await findCustomerOrder(userId, orderId);
    if (outcome === "pending" ||
        outcome === "ignored" ||
        updated.status === "pending_payment") {
        throw new OrderError(409, "PAYMENT_STILL_PROCESSING", "The Stripe payment is not finalized. Inventory remains reserved.");
    }
    return {
        data: toOrderDetails(updated),
    };
}
