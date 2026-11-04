import "dotenv/config";
import process from "node:process";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
async function seedLampPreviewVariant() {
    // Prevent accidental production database changes.
    if (env.NODE_ENV === "production") {
        throw new Error("Development seed cannot run in production");
    }
    // Connect to MongoDB.
    await connectDatabase(env.MONGODB_URI);
    try {
        // Find the Orbit Desk Lamp.
        const product = await Product.findOne({
            slug: "orbit-desk-lamp",
        });
        if (!product) {
            throw new Error("Orbit Desk Lamp not found. Seed products first.");
        }
        // Add the Brass variant if it does not exist.
        await ProductVariant.updateOne({
            sku: "ORBIT-BRASS",
        }, {
            $setOnInsert: {
                productId: product._id,
                sku: "ORBIT-BRASS",
                color: "Brass",
                size: null,
                stockOnHand: 5,
                stockReserved: 0,
                active: true,
            },
        }, {
            upsert: true,
        });
        console.log("Brass lamp variant seeded successfully.");
    }
    finally {
        // Always disconnect from MongoDB.
        await disconnectDatabase();
    }
}
// Execute seed script.
seedLampPreviewVariant().catch((error) => {
    console.error("Variant seed failed:", error);
    // Return a nonzero exit code if seeding fails.
    process.exitCode = 1;
});
