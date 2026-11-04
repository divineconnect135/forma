import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { logger } from "./config/logger.js";
import { createSessionMiddleware } from "./config/session.js";
import { csrfProtection } from "./middleware/auth.js";
import { adminMutationLimiter, checkoutCreationLimiter, privateApiNoStore, requestBodyErrorHandler, } from "./middleware/apiSecurity.js";
import { authRouter } from "./routes/auth.routes.js";
import { productsRouter } from "./routes/products.routes.js";
import { cartRouter } from "./routes/cart.routes.js";
import { checkoutRouter } from "./routes/checkout.routes.js";
import { ordersRouter } from "./routes/orders.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { stripeWebhookHandler } from "./routes/stripeWebhook.routes.js";
import { CartError } from "./services/cart.service.js";
import { CheckoutError } from "./services/checkout.service.js";
import { CheckoutRecoveryError } from "./services/checkoutRecovery.service.js";
import { OrderError } from "./services/orders.service.js";
import { AdminManagementError } from "./services/adminManagement.service.js";
export const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
}
app.use(helmet());
app.use((req, res, next) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    res.setHeader("X-Request-Id", requestId);
    res.on("finish", () => {
        logger.info({
            requestId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs: Date.now() - startedAt,
        }, "HTTP request");
    });
    next();
});
// Stripe raw body must precede JSON middleware.
app.post("/api/webhooks/stripe", express.raw({
    type: "application/json",
    limit: "256kb",
}), stripeWebhookHandler);
app.use(express.json({ limit: "100kb" }));
app.use(requestBodyErrorHandler);
app.use("/api/checkout/session", checkoutCreationLimiter);
app.use("/api/checkout/resume", checkoutCreationLimiter);
app.use("/api/admin", adminMutationLimiter);
app.use(createSessionMiddleware());
app.use("/api", privateApiNoStore);
app.use("/api", csrfProtection);
app.get("/api/health/live", (_req, res) => {
    res.status(200).json({
        status: "ok",
    });
});
app.get("/api/health", (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
        status: connected ? "ok" : "degraded",
        database: connected ? "connected" : "disconnected",
    });
});
app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/cart", cartRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/admin", adminRouter);
app.use("/api", (_req, res) => {
    res.status(404).json({
        error: {
            code: "NOT_FOUND",
            message: "API route not found",
        },
    });
});
const expectedErrorNames = new Set([
    "CartError",
    "CheckoutError",
    "CheckoutRecoveryError",
    "OrderError",
    "AdminManagementError",
]);
const errorHandler = (error, req, res, next) => {
    if (res.headersSent) {
        next(error);
        return;
    }
    if (error instanceof Error &&
        expectedErrorNames.has(error.name) &&
        "status" in error &&
        typeof error.status === "number" &&
        error.status >= 400 &&
        error.status < 600 &&
        "code" in error &&
        typeof error.code === "string") {
        res.status(error.status).json({
            error: {
                code: error.code,
                message: error.message,
            },
        });
        return;
    }
    // Preserve direct class handling, including
    // errors raised from each existing service.
    if (error instanceof CartError ||
        error instanceof CheckoutError ||
        error instanceof CheckoutRecoveryError ||
        error instanceof OrderError ||
        error instanceof AdminManagementError) {
        res.status(error.status).json({
            error: {
                code: error.code,
                message: error.message,
            },
        });
        return;
    }
    logger.error({
        err: error,
        method: req.method,
        path: req.path,
    }, "Unhandled API error");
    res.status(500).json({
        error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
        },
    });
};
app.use(errorHandler);
