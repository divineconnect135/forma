import { z } from "zod";
const schema = z.object({
    NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    MONGODB_URI: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    TRUST_PROXY: z.enum(["0", "1"]).default("0"),
    LOG_LEVEL: z
        .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
        .default("info"),
});
export const env = schema.parse(process.env);
