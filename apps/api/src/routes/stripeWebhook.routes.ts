import type { RequestHandler } from "express";

import { constructStripeWebhookEvent } from "../services/stripe.service.js";

import { handleStripeCheckoutEvent } from "../services/orderSettlement.service.js";

export const stripeWebhookHandler: RequestHandler = async (req, res, next) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({
      error: {
        code: "WEBHOOK_NOT_CONFIGURED",
        message: "Webhook is unavailable",
      },
    });
    return;
  }

  const signature = req.get("stripe-signature");

  if (!signature || !Buffer.isBuffer(req.body)) {
    res.status(400).json({
      error: {
        code: "INVALID_WEBHOOK",
        message: "Invalid webhook request",
      },
    });
    return;
  }

  let event;

  try {
    event = constructStripeWebhookEvent(req.body as Buffer, signature);
  } catch {
    res.status(400).json({
      error: {
        code: "INVALID_SIGNATURE",
        message: "Webhook signature verification failed",
      },
    });
    return;
  }

  try {
    const result = await handleStripeCheckoutEvent(event);

    res.status(200).json({
      received: true,
      result,
    });
  } catch (error) {
    // Return an error so Stripe can retry.
    // Do not acknowledge a failed stock transaction.
    next(error);
  }
};
