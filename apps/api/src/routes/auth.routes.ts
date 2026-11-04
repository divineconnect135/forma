import { randomBytes } from "node:crypto";

import { Router, type Request } from "express";

import rateLimit from "express-rate-limit";

import { issueCsrfToken, requireAuth } from "../middleware/auth.js";

import {
  authenticateCustomer,
  DuplicateEmailError,
  registerCustomer,
  toPublicUser,
} from "../services/auth.service.js";

import { loginSchema, registerSchema } from "../validators/auth.js";

import { SESSION_COOKIE_NAME } from "../config/session.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,

  // Unit and integration tests must not interfere
  // with each other through shared rate limits.
  skip: () => process.env.NODE_ENV === "test" || Boolean(process.env.VITEST),

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many attempts. Try again later.",
    },
  },
});

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function establishSession(req: Request, userId: string) {
  await regenerateSession(req);

  req.session.userId = userId;

  // Rotate CSRF token after successful authentication.
  req.session.csrfToken = randomBytes(32).toString("hex");

  await saveSession(req);
}

// GET /api/auth/csrf
authRouter.get("/csrf", (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  res.json({
    csrfToken: issueCsrfToken(req),
  });
});

// POST /api/auth/register
authRouter.post("/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid registration information",
      },
    });
    return;
  }

  try {
    const user = await registerCustomer(parsed.data);

    await establishSession(req, String(user._id));

    res.status(201).json({
      data: {
        user: toPublicUser(user),
      },
    });
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      res.status(409).json({
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "Email address is already registered",
        },
      });
      return;
    }

    throw error;
  }
});

// POST /api/auth/login
authRouter.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid login information",
      },
    });
    return;
  }

  const user = await authenticateCustomer(parsed.data);

  if (!user) {
    res.status(401).json({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      },
    });
    return;
  }

  await establishSession(req, String(user._id));

  res.status(200).json({
    data: {
      user: toPublicUser(user),
    },
  });
});

// GET /api/auth/me
authRouter.get("/me", requireAuth, (_req, res) => {
  res.setHeader("Cache-Control", "no-store");

  res.json({
    data: {
      user: toPublicUser(res.locals.currentUser),
    },
  });
});

// POST /api/auth/logout
authRouter.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    res.clearCookie(SESSION_COOKIE_NAME, {
      path: "/",
    });

    res.status(204).end();
  });
});
