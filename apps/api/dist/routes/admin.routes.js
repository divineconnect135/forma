import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { getAdminOverview } from "../services/admin.service.js";
import { AdminManagementError, listAdminProducts, getAdminProduct, createAdminProduct, updateAdminProduct, archiveAdminProduct, createAdminVariant, updateAdminVariant, adjustAdminStock, listAdminInventory, listAdminOrders, getAdminOrder, updateAdminFulfillment, listAdminCustomers, listAdminAudit, } from "../services/adminManagement.service.js";
import { objectIdSchema, createAdminProductSchema, updateAdminProductSchema, createAdminVariantSchema, updateAdminVariantSchema, adjustStockSchema, fulfillmentSchema, adminPageSchema, adminOrderQuerySchema, adminInventoryQuerySchema, } from "../validators/admin.js";
export const adminRouter = Router();
// Protect ALL endpoints, including future additions.
adminRouter.use(requireAuth);
adminRouter.use(requireAdmin);
function validate(schema, value) {
    const result = schema.safeParse(value);
    if (!result.success) {
        throw new AdminManagementError(400, "VALIDATION_ERROR", "Invalid administration request");
    }
    return result.data;
}
function resourceId(value) {
    return validate(objectIdSchema, value);
}
// STEP 1 — Dashboard
adminRouter.get("/overview", async (_req, res) => {
    const result = await getAdminOverview();
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
});
// STEP 2 — Product management
adminRouter.get("/products", async (req, res) => {
    const query = validate(adminPageSchema, req.query);
    const result = await listAdminProducts(query.page, query.limit);
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
});
adminRouter.post("/products", async (req, res) => {
    const body = validate(createAdminProductSchema, req.body);
    const result = await createAdminProduct(req.session.userId, body);
    res.status(201).json(result);
});
adminRouter.get("/products/:productId", async (req, res) => {
    const result = await getAdminProduct(resourceId(req.params.productId));
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
});
adminRouter.patch("/products/:productId", async (req, res) => {
    const body = validate(updateAdminProductSchema, req.body);
    const result = await updateAdminProduct(req.session.userId, resourceId(req.params.productId), body);
    res.json(result);
});
adminRouter.post("/products/:productId/archive", async (req, res) => {
    const result = await archiveAdminProduct(req.session.userId, resourceId(req.params.productId));
    res.json(result);
});
adminRouter.post("/products/:productId/variants", async (req, res) => {
    const body = validate(createAdminVariantSchema, req.body);
    const result = await createAdminVariant(req.session.userId, resourceId(req.params.productId), body);
    res.status(201).json(result);
});
adminRouter.patch("/variants/:variantId", async (req, res) => {
    const body = validate(updateAdminVariantSchema, req.body);
    const result = await updateAdminVariant(req.session.userId, resourceId(req.params.variantId), body);
    res.json(result);
});
// STEP 3 — Inventory
adminRouter.get("/inventory", async (req, res) => {
    const query = validate(adminInventoryQuerySchema, req.query);
    const result = await listAdminInventory(query.page, query.limit, query.stock);
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
});
adminRouter.post("/variants/:variantId/adjust-stock", async (req, res) => {
    const body = validate(adjustStockSchema, req.body);
    const result = await adjustAdminStock(req.session.userId, resourceId(req.params.variantId), body);
    res.json(result);
});
// STEP 3 — Orders and fulfillment
adminRouter.get("/orders", async (req, res) => {
    const query = validate(adminOrderQuerySchema, req.query);
    const result = await listAdminOrders(query.page, query.limit, query.status);
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
});
adminRouter.get("/orders/:orderId", async (req, res) => {
    const result = await getAdminOrder(resourceId(req.params.orderId));
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
});
adminRouter.patch("/orders/:orderId/fulfillment", async (req, res) => {
    const body = validate(fulfillmentSchema, req.body);
    const result = await updateAdminFulfillment(req.session.userId, resourceId(req.params.orderId), body);
    res.json(result);
});
// STEP 4 — Customers (read-only)
adminRouter.get("/customers", async (req, res) => {
    const query = validate(adminPageSchema, req.query);
    const result = await listAdminCustomers(query.page, query.limit);
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
});
// STEP 4 — Audit history (read-only)
adminRouter.get("/audit", async (req, res) => {
    const query = validate(adminPageSchema, req.query);
    const result = await listAdminAudit(query.page, query.limit);
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
});
