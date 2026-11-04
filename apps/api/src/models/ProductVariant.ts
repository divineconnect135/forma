import { Schema, model } from "mongoose";

const productVariantSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },

    color: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },

    size: {
      type: String,
      trim: true,
      maxlength: 40,
      default: null,
    },

    stockOnHand: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },

    stockReserved: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

productVariantSchema.index({ sku: 1 }, { unique: true });

productVariantSchema.index({
  productId: 1,
  active: 1,
});

export const ProductVariant = model("ProductVariant", productVariantSchema);
