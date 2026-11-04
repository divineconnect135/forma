import { rateLimit } from "express-rate-limit";
// ---------------------------------------------
// 1. Checkout creation rate limiting
// ---------------------------------------------
// Limit how often one client IP can attempt
// to create Stripe Checkout Sessions.
//
// Existing authenticated sessions, CSRF protection,
// order idempotency, and stock checks still apply.
export const checkoutCreationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        error: {
            code: "TOO_MANY_CHECKOUT_REQUESTS",
            message: "Too many checkout attempts. Try again later.",
        },
    },
});
// ---------------------------------------------
// 2. Admin mutation rate limiting
// ---------------------------------------------
// Read-only dashboard requests are not counted.
// Product creation, updates, stock changes,
// and fulfillment modifications are counted.
export const adminMutationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 180,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => !["POST", "PATCH", "PUT", "DELETE"].includes(req.method),
    message: {
        error: {
            code: "TOO_MANY_ADMIN_REQUESTS",
            message: "Too many administrative changes. Try again later.",
        },
    },
});
// ---------------------------------------------
// 3. Private response cache protection
// ---------------------------------------------
const privatePaths = ["/auth", "/cart", "/checkout", "/orders", "/admin"];
// Mount under /api.
//
// Public products and health endpoints are not
// changed by this middleware.
export const privateApiNoStore = (req, res, next) => {
    const privateResponse = privatePaths.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`));
    if (privateResponse) {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Pragma", "no-cache");
    }
    next();
};
// ---------------------------------------------
// 4. Safe request-body error handling
// ---------------------------------------------
// Body parsing happens before the application's
// ordinary JSON error handler.
//
// Return a consistent response rather than
// exposing raw parser errors to the browser.
export const requestBodyErrorHandler = (error, _req, res, next) => {
    if (res.headersSent) {
        next(error);
        return;
    }
    const errorType = typeof error === "object" &&
        error !== null &&
        "type" in error &&
        typeof error.type === "string"
        ? error.type
        : null;
    if (errorType === "entity.parse.failed") {
        res.status(400).json({
            error: {
                code: "INVALID_JSON",
                message: "Request body contains invalid JSON.",
            },
        });
        return;
    }
    if (errorType === "entity.too.large") {
        res.status(413).json({
            error: {
                code: "PAYLOAD_TOO_LARGE",
                message: "Request body exceeds the permitted size.",
            },
        });
        return;
    }
    if (errorType === "request.aborted") {
        res.status(400).json({
            error: {
                code: "REQUEST_ABORTED",
                message: "The request was interrupted.",
            },
        });
        return;
    }
    next(error);
};
