import mongoose from "mongoose";
import { logger } from "./logger.js";
export async function connectDatabase(uri) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    logger.info("MongoDB connected");
}
export async function disconnectDatabase() {
    await mongoose.disconnect();
}
