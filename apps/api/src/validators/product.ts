import { z } from "zod";
import { productCategories } from "../models/Product.js";

// Price values are integer cents, not dollars.
// Maximum supported value: 999,999,999 cents.
const priceCentsSchema = z
  .string()
  .regex(/^(0|[1-9]\d{0,8})$/, {
    message: "Price must be a valid amount in cents",
  })
  .transform(Number);

export const listProductsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(24).default(12),

    category: z.enum(productCategories).optional(),

    search: z.string().trim().min(1).max(80).optional(),

    sort: z.enum(["newest", "price-asc", "price-desc"]).default("newest"),

    minPriceCents: priceCentsSchema.optional(),

    maxPriceCents: priceCentsSchema.optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.minPriceCents === undefined ||
      data.maxPriceCents === undefined ||
      data.minPriceCents <= data.maxPriceCents,
    {
      message: "Minimum price cannot exceed maximum price",
      path: ["maxPriceCents"],
    },
  );

export const productSlugSchema = z
  .string()
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
