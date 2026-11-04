import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";

import { getAdminOverview } from "../services/admin.service.js";

export const adminRouter = Router();

// Authentication runs first.
// Role authorization runs second.
adminRouter.use(requireAuth);
adminRouter.use(requireAdmin);

// GET /api/admin/overview
adminRouter.get("/overview", async (_req, res) => {
  const result = await getAdminOverview();

  res.setHeader("Cache-Control", "no-store");

  res.status(200).json(result);
});
