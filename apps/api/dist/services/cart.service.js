import mongoose, { Types } from "mongoose";
import { Cart } from "../models/Cart.js";
import { Product } from "../models/Product.js";
import { ProductVariant } from "../models/ProductVariant.js";
export class CartError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = "CartError";
    }
}
async function getOrCreateCart(userId) {
    const id = new Types.ObjectId(userId);
    return Cart.findOneAndUpdate({ userId: id }, {
        $setOnInsert: {
            userId: id,
            items: [],
            appliedMergeIds: [],
        },
    }, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        projection: { appliedMergeIds: 1, items: 1 },
    });
}
// Retry competing edits instead of silently overwriting
// another request's cart changes.
async function changeCart(userId, change) {
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            const cart = await getOrCreateCart(userId);
            if (!cart) {
                throw new Error("Unable to load cart");
            }
            const currentItems = cart.items.map((item) => ({
                variantId: String(item.variantId),
                quantity: item.quantity,
            }));
            const result = await change(currentItems, [...cart.appliedMergeIds]);
            if (result.skip) {
                return;
            }
            cart.set("items", result.items.map((item) => ({
                variantId: new Types.ObjectId(item.variantId),
                quantity: item.quantity,
            })));
            cart.set("appliedMergeIds", result.mergeIds);
            await cart.save();
            return;
        }
        catch (error) {
            const versionConflict = error instanceof mongoose.Error.VersionError;
            const duplicateCreation = typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === 11000;
            if ((versionConflict || duplicateCreation) && attempt < 3) {
                continue;
            }
            throw error;
        }
    }
}
async function ensureAvailableVariant(variantId, quantity) {
    const variant = await ProductVariant.findById(variantId).lean();
    if (!variant || !variant.active) {
        throw new CartError(404, "VARIANT_NOT_FOUND", "This product variant is unavailable");
    }
    const product = await Product.findById(variant.productId).lean();
    if (!product || product.status !== "active") {
        throw new CartError(404, "PRODUCT_UNAVAILABLE", "This product is unavailable");
    }
    const available = Math.max(0, variant.stockOnHand - variant.stockReserved);
    if (quantity > available) {
        throw new CartError(409, "INSUFFICIENT_STOCK", `Only ${available} units are available`);
    }
}
function validateCartSize(items) {
    if (items.length > 30) {
        throw new CartError(400, "CART_LIMIT", "A cart can contain at most 30 variants");
    }
}
// Build a server-authoritative view of product
// names, prices, availability, and totals.
export async function previewCart(entries) {
    const variantIds = entries.map((item) => item.variantId);
    const variants = await ProductVariant.find({
        _id: { $in: variantIds },
    }).lean();
    const products = await Product.find({
        _id: {
            $in: variants.map((variant) => variant.productId),
        },
    }).lean();
    const variantMap = new Map(variants.map((variant) => [String(variant._id), variant]));
    const productMap = new Map(products.map((product) => [String(product._id), product]));
    let subtotalCents = 0;
    let hasUnavailableItems = false;
    const items = entries.map((entry) => {
        const variant = variantMap.get(entry.variantId);
        const product = variant
            ? productMap.get(String(variant.productId))
            : undefined;
        const availableQuantity = variant
            ? Math.max(0, variant.stockOnHand - variant.stockReserved)
            : 0;
        const active = Boolean(variant?.active && product?.status === "active");
        const canPurchase = active && entry.quantity <= availableQuantity;
        if (!canPurchase) {
            hasUnavailableItems = true;
        }
        const priceCents = product?.priceCents ?? 0;
        // Invalid and out-of-stock lines are excluded
        // from the purchasable subtotal.
        if (canPurchase) {
            subtotalCents += priceCents * entry.quantity;
        }
        return {
            variantId: entry.variantId,
            productSlug: product?.slug ?? null,
            productName: product?.name ?? "Unavailable product",
            sku: variant?.sku ?? null,
            color: variant?.color ?? null,
            size: variant?.size ?? null,
            imageUrl: product?.images[0] ?? null,
            unitPriceCents: priceCents,
            quantity: entry.quantity,
            availableQuantity,
            canPurchase,
        };
    });
    return {
        data: {
            items,
            itemCount: entries.reduce((total, item) => total + item.quantity, 0),
            subtotalCents,
            currency: "USD",
            hasUnavailableItems,
        },
    };
}
export async function getCart(userId) {
    const cart = await Cart.findOne({
        userId: new Types.ObjectId(userId),
    }).lean();
    if (!cart) {
        return previewCart([]);
    }
    const items = cart.items.map((item) => ({
        variantId: String(item.variantId),
        quantity: item.quantity,
    }));
    return previewCart(items);
}
export async function addCartItem(userId, item) {
    await changeCart(userId, async (items, mergeIds) => {
        const existing = items.find((entry) => entry.variantId === item.variantId);
        const newQuantity = (existing?.quantity ?? 0) + item.quantity;
        if (newQuantity > 20) {
            throw new CartError(400, "QUANTITY_LIMIT", "Maximum quantity is 20 per variant");
        }
        await ensureAvailableVariant(item.variantId, newQuantity);
        const updated = existing
            ? items.map((entry) => entry.variantId === item.variantId
                ? { ...entry, quantity: newQuantity }
                : entry)
            : [...items, item];
        validateCartSize(updated);
        return { items: updated, mergeIds };
    });
    return getCart(userId);
}
export async function updateCartItem(userId, variantId, quantity) {
    await changeCart(userId, async (items, mergeIds) => {
        if (!items.some((item) => item.variantId === variantId)) {
            throw new CartError(404, "CART_ITEM_NOT_FOUND", "Item not found in cart");
        }
        await ensureAvailableVariant(variantId, quantity);
        return {
            items: items.map((item) => item.variantId === variantId ? { ...item, quantity } : item),
            mergeIds,
        };
    });
    return getCart(userId);
}
export async function removeCartItem(userId, variantId) {
    await changeCart(userId, async (items, mergeIds) => ({
        items: items.filter((item) => item.variantId !== variantId),
        mergeIds,
    }));
    return getCart(userId);
}
// A merge ID is recorded with the cart change.
// Retrying the same merge cannot add quantities again.
export async function mergeGuestCart(userId, mergeId, guestItems) {
    await changeCart(userId, async (items, mergeIds) => {
        if (mergeIds.includes(mergeId)) {
            return {
                items,
                mergeIds,
                skip: true,
            };
        }
        const updated = [...items];
        for (const guestItem of guestItems) {
            const index = updated.findIndex((item) => item.variantId === guestItem.variantId);
            const existingQuantity = index >= 0 ? updated[index].quantity : 0;
            const quantity = existingQuantity + guestItem.quantity;
            if (quantity > 20) {
                throw new CartError(400, "QUANTITY_LIMIT", "Maximum quantity is 20 per variant");
            }
            await ensureAvailableVariant(guestItem.variantId, quantity);
            if (index >= 0) {
                updated[index] = {
                    variantId: guestItem.variantId,
                    quantity,
                };
            }
            else {
                updated.push({
                    variantId: guestItem.variantId,
                    quantity,
                });
            }
        }
        validateCartSize(updated);
        return {
            items: updated,
            mergeIds: [...mergeIds, mergeId].slice(-50),
        };
    });
    return getCart(userId);
}
