import { z } from "zod";

export const createCheckoutSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
  })
  .strict();
