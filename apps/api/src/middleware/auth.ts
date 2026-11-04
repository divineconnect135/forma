import { randomBytes, timingSafeEqual } from "node:crypto";

import type { Request, RequestHandler } from "express";

import { User } from "../models/User.js";

export function issueCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString("hex");
  }

  return req.session.csrfToken;
}

export const csrfProtection: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }

  // Stripe webhooks will have their own signature
  // verification when payment integration is added.
  if (req.path === "/webhooks/stripe") {
    next();
    return;
  }

  const expected = req.session.csrfToken;
  const provided = req.get("x-csrf-token");

  if (!expected || !provided || !/^[a-f0-9]{64}$/i.test(provided)) {
    res.status(403).json({
      error: {
        code: "INVALID_CSRF_TOKEN",
        message: "Invalid or missing CSRF token",
      },
    });
    return;
  }

  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(provided, "hex");

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    res.status(403).json({
      error: {
        code: "INVALID_CSRF_TOKEN",
        message: "Invalid or missing CSRF token",
      },
    });
    return;
  }

  next();
};

export const requireAuth: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId;

  if (!userId) {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Please sign in to continue",
      },
    });
    return;
  }

  const user = await User.findById(userId);

  if (!user || !user.active) {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Session is no longer valid",
      },
    });
    return;
  }

  res.locals.currentUser = user;
  next();
};

export const requireAdmin: RequestHandler = (_req, res, next) => {
  const user = res.locals.currentUser;

  if (!user || user.role !== "admin") {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Administrator access required",
      },
    });
    return;
  }

  next();
};
