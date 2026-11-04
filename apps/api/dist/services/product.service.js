import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
export function getAvailableQuantity(stockOnHand, stockReserved) {
    return Math.max(0, stockOnHand - stockReserved);
}
export async function listProducts(query) {
    const { page, limit, category, search, sort, minPriceCents, maxPriceCents } = query;
    const filter = {
        status: "active",
    };
    // Category filtering
    if (category) {
        filter.category = category;
    }
    // MongoDB text search
    if (search) {
        filter.$text = { $search: search };
    }
    // Price filtering
    if (minPriceCents !== undefined || maxPriceCents !== undefined) {
        const priceFilter = {};
        if (minPriceCents !== undefined) {
            priceFilter.$gte = minPriceCents;
        }
        if (maxPriceCents !== undefined) {
            priceFilter.$lte = maxPriceCents;
        }
        filter.priceCents = priceFilter;
    }
    // Deterministic sorting
    const sortOrder = sort === "price-asc"
        ? { priceCents: 1, _id: 1 }
        : sort === "price-desc"
            ? { priceCents: -1, _id: 1 }
            : { createdAt: -1, _id: -1 };
    const [products, total] = await Promise.all([
        Product.find(filter)
            .sort(sortOrder)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Product.countDocuments(filter),
    ]);
    return {
        data: products,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}
// Product details service from Step 3.
export async function getProductBySlug(slug) {
    const product = await Product.findOne({
        slug,
        status: "active",
    }).lean();
    if (!product) {
        return null;
    }
    const variants = await ProductVariant.find({
        productId: product._id,
        active: true,
    })
        .select("sku color size stockOnHand stockReserved")
        .sort({
        color: 1,
        size: 1,
        _id: 1,
    })
        .lean();
    const publicVariants = variants.map((variant) => {
        const availableQuantity = getAvailableQuantity(variant.stockOnHand, variant.stockReserved);
        return {
            _id: String(variant._id),
            sku: variant.sku,
            color: variant.color,
            size: variant.size,
            availableQuantity,
            inStock: availableQuantity > 0,
        };
    });
    return {
        ...product,
        variants: publicVariants,
    };
}
