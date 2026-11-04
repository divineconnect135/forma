import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { cancelCustomerCheckout, getCustomerOrder, listCustomerOrders, } from "../services/orders.service.js";
export const ordersRouter = Router();
ordersRouter.use(requireAuth);
const querySchema = z
    .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(20).default(10),
})
    .strict();
const orderIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/);
// GET /api/orders?page=1&limit=10
ordersRouter.get("/", async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({
            error: {
                code: "INVALID_QUERY",
                message: "Invalid order query",
            },
        });
        return;
    }
    const result = await listCustomerOrders(req.session.userId, parsed.data.page, parsed.data.limit);
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
});
// GET /api/orders/:orderId
ordersRouter.get("/:orderId", async (req, res) => {
    const parsed = orderIdSchema.safeParse(req.params.orderId);
    if (!parsed.success) {
        res.status(400).json({
            error: {
                code: "INVALID_ORDER_ID",
                message: "Invalid order ID",
            },
        });
        return;
    }
    const result = await getCustomerOrder(req.session.userId, parsed.data);
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
});
// POST /api/orders/:orderId/cancel
// Only cancels an unfinished Stripe checkout.
ordersRouter.post("/:orderId/cancel", async (req, res) => {
    const parsed = orderIdSchema.safeParse(req.params.orderId);
    if (!parsed.success) {
        res.status(400).json({
            error: {
                code: "INVALID_ORDER_ID",
                message: "Invalid order ID",
            },
        });
        return;
    }
    const result = await cancelCustomerCheckout(req.session.userId, parsed.data);
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
});
