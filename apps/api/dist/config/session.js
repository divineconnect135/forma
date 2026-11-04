import session from "express-session";
import MongoStore from "connect-mongo";
export const SESSION_COOKIE_NAME = "forma.sid";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export function createSessionMiddleware() {
    const isTest = Boolean(process.env.VITEST) || process.env.NODE_ENV === "test";
    const secret = process.env.SESSION_SECRET ??
        (isTest ? "forma-test-only-session-secret-not-for-production" : undefined);
    if (!secret || secret.length < 32) {
        throw new Error("SESSION_SECRET must contain at least 32 characters");
    }
    const mongoUri = process.env.MONGODB_URI;
    if (!isTest && !mongoUri) {
        throw new Error("MONGODB_URI is required");
    }
    const store = isTest
        ? undefined
        : MongoStore.create({
            mongoUrl: mongoUri,
            collectionName: "sessions",
            ttl: SESSION_MAX_AGE / 1000,
            touchAfter: 60 * 60,
        });
    return session({
        name: SESSION_COOKIE_NAME,
        secret,
        store,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: SESSION_MAX_AGE,
            path: "/",
        },
    });
}
