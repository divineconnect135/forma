import { Schema, model } from "mongoose";
const cartItemSchema = new Schema({
    variantId: {
        type: Schema.Types.ObjectId,
        ref: "ProductVariant",
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        max: 20,
        validate: Number.isInteger,
    },
}, { _id: false });
const cartSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    items: {
        type: [cartItemSchema],
        default: [],
    },
    appliedMergeIds: {
        type: [String],
        default: [],
        select: false,
    },
}, {
    timestamps: true,
    optimisticConcurrency: true,
});
cartSchema.index({ userId: 1 }, { unique: true });
export const Cart = model("Cart", cartSchema);
