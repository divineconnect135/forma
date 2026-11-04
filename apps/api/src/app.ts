import "dotenv/config";

import { randomUUID } from "node:crypto";

import express, { type ErrorRequestHandler } from "express";

import helmet from "helmet";
import mongoose from "mongoose";

import { logger } from "./config/logger.js";
import { createSessionMiddleware } from "./config/session.js";

import { csrfProtection } from "./middleware/auth.js";

import { authRouter } from "./routes/auth.routes.js";
import { productsRouter } from "./routes/products.routes.js";
import { cartRouter } from "./routes/cart.routes.js";
import { checkoutRouter } from "./routes/checkout.routes.js";
import { ordersRouter } from "./routes/orders.routes.js";
import { adminRouter } from "./routes/admin.routes.js";

import { stripeWebhookHandler } from "./routes/stripeWebhook.routes.js";

import { CartError } from "./services/cart.service.js";
import { CheckoutError } from "./services/checkout.service.js";
import { OrderError } from "./services/orders.service.js";

export const app = express();

app.disable("x-powered-by");

if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

// Security headers
app.use(helmet());

// Request logging
app.use((req, res, next) => {
  const requestId = randomUUID();
  const startedAt = Date.now();

  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    logger.info(
      {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
      "HTTP request",
    );
  });

  next();
});

// Stripe must receive the original raw request body.
// Do not place this route below express.json().
app.post(
  "/api/webhooks/stripe",
  express.raw({
    type: "application/json",
    limit: "256kb",
  }),
  stripeWebhookHandler,
);

// Standard API middleware
app.use(express.json({ limit: "100kb" }));
app.use(createSessionMiddleware());

app.use("/api", csrfProtection);

// Health checks
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

// Customer APIs
app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/cart", cartRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/orders", ordersRouter);

// Admin-only APIs
app.use("/api/admin", adminRouter);

// API 404
app.use("/api", (_req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "API route not found",
    },
  });
});

function isExpectedError(
  error: unknown,
): error is CartError | CheckoutError | OrderError {
  if (
    error instanceof CartError ||
    error instanceof CheckoutError ||
    error instanceof OrderError
  ) {
    return true;
  }

  if (!(error instanceof Error) || !("status" in error) || !("code" in error)) {
    return false;
  }

  return (
    ["CartError", "CheckoutError", "OrderError"].includes(error.name) &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 600 &&
    typeof error.code === "string"
  );
}

// Centralized JSON error handling
const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (isExpectedError(error)) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  logger.error(
    {
      err: error,
      method: req.method,
      path: req.path,
    },
    "Unhandled API error",
  );

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
};

app.use(errorHandler);
