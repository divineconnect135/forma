import { z } from "zod";
export const variantIdSchema = z
    .string()
    .regex(/^[a-fA-F0-9]{24}$/, "Invalid variant ID");
export const quantitySchema = z.number().int().min(1).max(20);
export const cartItemSchema = z
    .object({
    variantId: variantIdSchema,
    quantity: quantitySchema,
})
    .strict();
export const cartItemsSchema = z
    .array(cartItemSchema)
    .max(30)
    .superRefine((items, ctx) => {
    const ids = new Set();
    items.forEach((item, index) => {
        const id = item.variantId.toLowerCase();
        if (ids.has(id)) {
            ctx.addIssue({
                code: "custom",
                path: [index, "variantId"],
                message: "Duplicate cart variant",
            });
        }
        ids.add(id);
    });
});
export const updateQuantitySchema = z
    .object({
    quantity: quantitySchema,
})
    .strict();
export const mergeCartSchema = z
    .object({
    mergeId: z.string().uuid(),
    items: cartItemsSchema,
})
    .strict();
export const previewCartSchema = z
    .object({
    items: cartItemsSchema,
})
    .strict();
