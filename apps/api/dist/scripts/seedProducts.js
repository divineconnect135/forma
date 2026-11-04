import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { Product } from "../models/Product.js";
const products = [
    {
        name: "Orbit Desk Lamp",
        slug: "orbit-desk-lamp",
        description: "An adjustable desk lamp with a refined silhouette and focused task lighting.",
        category: "lighting",
        priceCents: 12900,
        featured: true,
    },
    {
        name: "Arc Lounge Chair",
        slug: "arc-lounge-chair",
        description: "A comfortable lounge chair with sculptural curves and a minimalist profile.",
        category: "furniture",
        priceCents: 34900,
        featured: true,
    },
    {
        name: "Modular Desk Tray",
        slug: "modular-desk-tray",
        description: "A practical desk organizer designed to bring order to everyday essentials.",
        category: "accessories",
        priceCents: 3900,
        featured: false,
    },
    {
        name: "Halo Pendant Light",
        slug: "halo-pendant-light",
        description: "A contemporary pendant light designed for warm and inviting interiors.",
        category: "lighting",
        priceCents: 21900,
        featured: true,
    },
    {
        name: "Linear Floor Lamp",
        slug: "linear-floor-lamp",
        description: "A slender floor lamp combining ambient illumination and modern styling.",
        category: "lighting",
        priceCents: 18900,
        featured: false,
    },
    {
        name: "Contour Dining Chair",
        slug: "contour-dining-chair",
        description: "A clean-lined dining chair with a supportive seat and understated design.",
        category: "furniture",
        priceCents: 27900,
        featured: false,
    },
    {
        name: "Atelier Side Table",
        slug: "atelier-side-table",
        description: "A versatile side table with a compact footprint for modern living spaces.",
        category: "furniture",
        priceCents: 19900,
        featured: false,
    },
    {
        name: "Stoneware Catchall",
        slug: "stoneware-catchall",
        description: "A simple decorative tray for keys, accessories, and small personal items.",
        category: "accessories",
        priceCents: 4500,
        featured: false,
    },
    {
        name: "Grid Monitor Stand",
        slug: "grid-monitor-stand",
        description: "A desktop riser that creates additional storage and a more organized workspace.",
        category: "accessories",
        priceCents: 7900,
        featured: false,
    },
];
async function seedProducts() {
    if (env.NODE_ENV === "production") {
        throw new Error("Cannot seed products in production");
    }
    await connectDatabase(env.MONGODB_URI);
    try {
        await Product.init();
        for (const product of products) {
            await Product.updateOne({ slug: product.slug }, {
                $setOnInsert: {
                    ...product,
                    currency: "USD",
                    images: [],
                    modelUrl: null,
                    status: "active",
                },
            }, { upsert: true });
        }
        console.log("Product seed completed successfully.");
    }
    finally {
        await disconnectDatabase();
    }
}
seedProducts().catch((error) => {
    console.error("Product seed failed:", error);
    process.exitCode = 1;
});
