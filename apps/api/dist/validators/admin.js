import { z } from "zod";
export const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/);
const imageUrlSchema = z
    .string()
    .refine((value) => /^\/images\/[a-zA-Z0-9/_-]+\.(png|jpg|jpeg|webp)$/i.test(value) ||
    /^https:\/\/[^\s]+$/i.test(value), "Use an HTTPS image URL or a local /images/ path");
const modelUrlSchema = z
    .string()
    .regex(/^\/models\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.glb$/)
    .nullable();
const productFields = {
    name: z.string().trim().min(3).max(120),
    slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .max(120),
    description: z.string().trim().min(10).max(3000),
    category: z
        .string()
        .trim()
        .regex(/^[a-z][a-z0-9-]{1,39}$/),
    priceCents: z.number().int().min(1).max(10_000_000),
    featured: z.boolean(),
    images: z.array(imageUrlSchema).max(8),
    modelUrl: modelUrlSchema,
    status: z.enum(["active", "archived"]),
};
export const createAdminProductSchema = z
    .object({
    ...productFields,
    featured: productFields.featured.default(false),
    images: productFields.images.default([]),
    modelUrl: productFields.modelUrl.default(null),
    status: productFields.status.default("archived"),
})
    .strict();
export const updateAdminProductSchema = z
    .object(productFields)
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, "At least one product field is required");
export const createAdminVariantSchema = z
    .object({
    sku: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_-]{3,60}$/),
    color: z.string().trim().min(1).max(50),
    size: z.string().trim().max(50).nullable(),
})
    .strict();
export const updateAdminVariantSchema = z
    .object({
    color: z.string().trim().min(1).max(50),
    size: z.string().trim().max(50).nullable(),
    active: z.boolean(),
})
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0);
export const adjustStockSchema = z
    .object({
    delta: z
        .number()
        .int()
        .min(-10_000)
        .max(10_000)
        .refine((value) => value !== 0),
    reason: z.string().trim().min(8).max(180),
})
    .strict();
export const fulfillmentSchema = z
    .object({
    status: z.enum(["processing", "shipped", "delivered"]),
})
    .strict();
export const adminPageSchema = z
    .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
})
    .strict();
export const adminOrderQuerySchema = adminPageSchema.safeExtend({
    status: z
        .enum([
        "all",
        "pending_payment",
        "paid",
        "cancelled",
        "expired",
        "refunded",
    ])
        .default("all"),
});
export const adminInventoryQuerySchema = adminPageSchema.safeExtend({
    stock: z.enum(["all", "low", "out"]).default("all"),
});
