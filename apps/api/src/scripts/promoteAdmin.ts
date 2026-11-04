import "dotenv/config";

import process from "node:process";

import { connectDatabase, disconnectDatabase } from "../config/database.js";

import { env } from "../config/env.js";
import { User } from "../models/User.js";

async function promoteAdmin() {
  // Never permit this script to run in production.
  if (env.NODE_ENV !== "development") {
    throw new Error("Admin promotion is only allowed in development");
  }

  // Require explicit confirmation.
  if (process.env.CONFIRM_ADMIN_PROMOTION !== "YES") {
    throw new Error(
      "Set CONFIRM_ADMIN_PROMOTION=YES to authorize this operation",
    );
  }

  const email = process.argv[2]?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Provide a valid registered customer email");
  }

  await connectDatabase(env.MONGODB_URI);

  try {
    const user = await User.findOne({
      email,
      active: true,
    });

    if (!user) {
      throw new Error("Active registered customer not found");
    }

    if (user.role === "admin") {
      console.log("This account is already an administrator.");
      return;
    }

    // This is a privileged database operation.
    // Never expose it as a public API route.
    user.set("role", "admin");

    await user.save();

    console.log(`Administrator role assigned to ${email}`);
  } finally {
    await disconnectDatabase();
  }
}

promoteAdmin().catch((error: unknown) => {
  console.error("Admin promotion failed:", error);

  process.exitCode = 1;
});
