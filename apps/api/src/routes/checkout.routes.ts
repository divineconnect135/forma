import { Router } from "express";
import { Types } from "mongoose";

import { requireAuth } from "../middleware/auth.js";
import { Order } from "../models/Order.js";

import {
  getCheckoutPreview,
  startCheckout,
} from "../services/checkout.service.js";

import {
  getActiveCheckout,
  resumeActiveCheckout,
} from "../services/checkoutRecovery.service.js";

import { createCheckoutSchema } from "../validators/checkout.js";

export const checkoutRouter = Router();

checkoutRouter.use(requireAuth);

// GET /api/checkout/preview
checkoutRouter.get("/preview", async (req, res) => {
  const result = await getCheckoutPreview(req.session.userId!);

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(result);
});

// GET /api/checkout/active
checkoutRouter.get("/active", async (req, res) => {
  const result = await getActiveCheckout(req.session.userId!);

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(result);
});

// POST /api/checkout/resume
// Uses the authenticated customer's saved order.
// No order ID or payment amount comes from the client.
checkoutRouter.post("/resume", async (req, res) => {
  const result = await resumeActiveCheckout(req.session.userId!);

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(result);
});

// POST /api/checkout/session
checkoutRouter.post("/session", async (req, res) => {
  const parsed = createCheckoutSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid checkout request.",
      },
    });
    return;
  }

  const result = await startCheckout(
    req.session.userId!,
    parsed.data.idempotencyKey,
  );

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(result);
});

// GET /api/checkout/status/:sessionId
checkoutRouter.get("/status/:sessionId", async (req, res) => {
  const sessionId = req.params.sessionId;

  if (
    typeof sessionId !== "string" ||
    !/^cs_test_[A-Za-z0-9_]+$/.test(sessionId)
  ) {
    res.status(400).json({
      error: {
        code: "INVALID_SESSION_ID",
        message: "Invalid checkout session ID.",
      },
    });
    return;
  }

  const order = await Order.findOne({
    userId: new Types.ObjectId(req.session.userId!),
    stripeCheckoutSessionId: sessionId,
  })
    .select("orderNumber status reservationStatus totalCents currency paidAt")
    .lean();

  if (!order) {
    res.status(404).json({
      error: {
        code: "ORDER_NOT_FOUND",
        message: "Order not found.",
      },
    });
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  res.status(200).json({
    data: {
      orderNumber: order.orderNumber,
      status: order.status,
      reservationStatus: order.reservationStatus,
      totalCents: order.totalCents,
      currency: order.currency,
      paidAt: order.paidAt,
    },
  });
});
