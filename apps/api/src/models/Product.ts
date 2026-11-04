import { Schema, model } from "mongoose";

export const productCategories = [
  "lighting",
  "furniture",
  "accessories",
] as const;

const productSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      required: true,
      enum: productCategories,
    },
    priceCents: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    currency: {
      type: String,
      enum: ["USD"],
      default: "USD",
    },
    images: {
      type: [String],
      default: [],
    },
    modelUrl: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "draft", "archived"],
      default: "draft",
    },
    featured: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

productSchema.index({ slug: 1 }, { unique: true });

productSchema.index({
  status: 1,
  category: 1,
  createdAt: -1,
});

productSchema.index({
  name: "text",
  description: "text",
});

export const Product = model("Product", productSchema);
