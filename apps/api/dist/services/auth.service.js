import argon2 from "argon2";
import { User } from "../models/User.js";
export class DuplicateEmailError extends Error {
    constructor() {
        super("Email address is already registered");
        this.name = "DuplicateEmailError";
    }
}
export function toPublicUser(user) {
    return {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
    };
}
export async function registerCustomer(input) {
    const passwordHash = await argon2.hash(input.password, {
        type: argon2.argon2id,
    });
    try {
        return await User.create({
            name: input.name,
            email: input.email,
            passwordHash,
            role: "customer",
            active: true,
        });
    }
    catch (error) {
        // MongoDB duplicate-key error.
        if (typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === 11000) {
            throw new DuplicateEmailError();
        }
        throw error;
    }
}
export async function authenticateCustomer(input) {
    const user = await User.findOne({
        email: input.email,
        active: true,
    }).select("+passwordHash");
    if (!user) {
        return null;
    }
    const validPassword = await argon2.verify(user.passwordHash, input.password);
    if (!validPassword) {
        return null;
    }
    return user;
}
