import { Router } from "express";

import { listProducts, getProductBySlug } from "../services/product.service.js";

import {
  listProductsQuerySchema,
  productSlugSchema,
} from "../validators/product.js";

export const productsRouter = Router();

// GET /api/products
productsRouter.get("/", async (req, res) => {
  const result = listProductsQuerySchema.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({
      error: {
        code: "INVALID_QUERY",
        message: "Invalid product query parameters",
      },
    });

    return;
  }

  const products = await listProducts(result.data);

  res.json(products);
});

// GET /api/products/:slug
productsRouter.get("/:slug", async (req, res) => {
  const result = productSlugSchema.safeParse(req.params.slug);

  if (!result.success) {
    res.status(400).json({
      error: {
        code: "INVALID_SLUG",
        message: "Invalid product slug",
      },
    });

    return;
  }

  const product = await getProductBySlug(result.data);

  if (!product) {
    res.status(404).json({
      error: {
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found",
      },
    });

    return;
  }

  res.status(200).json({
    data: product,
  });
});
