import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
const variants = [
    {
        productSlug: "orbit-desk-lamp",
        sku: "ORBIT-BLACK",
        color: "Black",
        size: null,
        stockOnHand: 8,
    },
    {
        productSlug: "orbit-desk-lamp",
        sku: "ORBIT-IVORY",
        color: "Ivory",
        size: null,
        stockOnHand: 0,
    },
    {
        productSlug: "arc-lounge-chair",
        sku: "ARC-OLIVE",
        color: "Olive",
        size: "Standard",
        stockOnHand: 4,
    },
    {
        productSlug: "arc-lounge-chair",
        sku: "ARC-CREAM",
        color: "Cream",
        size: "Standard",
        stockOnHand: 6,
    },
    {
        productSlug: "modular-desk-tray",
        sku: "TRAY-SAND-S",
        color: "Sand",
        size: "Small",
        stockOnHand: 12,
    },
    {
        productSlug: "modular-desk-tray",
        sku: "TRAY-CHARCOAL-L",
        color: "Charcoal",
        size: "Large",
        stockOnHand: 5,
    },
    {
        productSlug: "halo-pendant-light",
        sku: "HALO-BRASS",
        color: "Brass",
        size: null,
        stockOnHand: 7,
    },
    {
        productSlug: "linear-floor-lamp",
        sku: "LINEAR-BLACK",
        color: "Black",
        size: null,
        stockOnHand: 5,
    },
    {
        productSlug: "contour-dining-chair",
        sku: "CONTOUR-OAK",
        color: "Natural Oak",
        size: "Standard",
        stockOnHand: 9,
    },
    {
        productSlug: "atelier-side-table",
        sku: "ATELIER-WALNUT",
        color: "Walnut",
        size: null,
        stockOnHand: 6,
    },
    {
        productSlug: "stoneware-catchall",
        sku: "STONE-SAND",
        color: "Sand",
        size: null,
        stockOnHand: 15,
    },
    {
        productSlug: "grid-monitor-stand",
        sku: "GRID-BLACK",
        color: "Black",
        size: "Standard",
        stockOnHand: 11,
    },
];
async function seedVariants() {
    if (env.NODE_ENV === "production") {
        throw new Error("Cannot seed variants in production");
    }
    await connectDatabase(env.MONGODB_URI);
    try {
        await ProductVariant.init();
        for (const variant of variants) {
            const product = await Product.findOne({
                slug: variant.productSlug,
            })
                .select("_id")
                .lean();
            if (!product) {
                throw new Error(`Product not found: ${variant.productSlug}`);
            }
            await ProductVariant.updateOne({ sku: variant.sku }, {
                $setOnInsert: {
                    productId: product._id,
                    sku: variant.sku,
                    color: variant.color,
                    size: variant.size,
                    stockOnHand: variant.stockOnHand,
                    stockReserved: 0,
                    active: true,
                },
            }, { upsert: true });
        }
        console.log("Product variants seeded successfully.");
    }
    finally {
        await disconnectDatabase();
    }
}
seedVariants().catch((error) => {
    console.error("Variant seed failed:", error);
    process.exitCode = 1;
});
