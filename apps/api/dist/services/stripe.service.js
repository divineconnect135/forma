import Stripe from "stripe";
let stripeClient = null;
export function getStripeClient() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey?.startsWith("sk_test_")) {
        throw new Error("A Stripe test secret key is required");
    }
    if (!stripeClient) {
        stripeClient = new Stripe(secretKey);
    }
    return stripeClient;
}
function getWebOrigin() {
    const value = process.env.WEB_ORIGIN;
    if (!value) {
        throw new Error("WEB_ORIGIN is required");
    }
    const url = new URL(value);
    const isLocal = url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !isLocal) {
        throw new Error("Invalid WEB_ORIGIN");
    }
    return url.origin;
}
export async function createStripeSession(input) {
    const stripe = getStripeClient();
    const webOrigin = getWebOrigin();
    const checkout = await stripe.checkout.sessions.create({
        mode: "payment",
        allowed_payment_method_types: ["card"],
        customer_email: input.customerEmail,
        client_reference_id: input.orderId,
        metadata: {
            orderId: input.orderId,
            orderNumber: input.orderNumber,
        },
        payment_intent_data: {
            metadata: {
                orderId: input.orderId,
            },
        },
        line_items: input.items.map((item) => ({
            price_data: {
                currency: "usd",
                unit_amount: item.unitPriceCents,
                product_data: {
                    name: item.name,
                    description: item.description,
                },
            },
            quantity: item.quantity,
        })),
        expires_at: Math.floor(input.expiresAt.getTime() / 1000),
        success_url: `${webOrigin}/checkout/success` + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: `${webOrigin}/checkout/cancel`,
    }, {
        idempotencyKey: `forma-order-${input.orderId}`,
    });
    if (checkout.livemode || !checkout.url) {
        throw new Error("Stripe did not return a test checkout URL");
    }
    return {
        sessionId: checkout.id,
        checkoutUrl: checkout.url,
        expiresAt: new Date(checkout.expires_at * 1000),
    };
}
// Verify the signature against the original raw body.
export function constructStripeWebhookEvent(payload, signature) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret?.startsWith("whsec_")) {
        throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }
    return getStripeClient().webhooks.constructEvent(payload, signature, secret);
}
// Always check the latest payment state with Stripe.
export async function retrieveStripeSession(sessionId) {
    return getStripeClient().checkout.sessions.retrieve(sessionId);
}
// Expiration is only possible for an open session.
export async function expireStripeSession(sessionId) {
    return getStripeClient().checkout.sessions.expire(sessionId);
}
