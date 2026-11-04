import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),

    email: emailSchema,

    password: z.string().min(12).max(128),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,

    password: z.string().min(1).max(128),
  })
  .strict();
