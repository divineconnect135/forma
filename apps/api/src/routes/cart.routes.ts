import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";

import {
  cartItemSchema,
  mergeCartSchema,
  previewCartSchema,
  updateQuantitySchema,
  variantIdSchema,
} from "../validators/cart.js";

import {
  addCartItem,
  getCart,
  mergeGuestCart,
  previewCart,
  removeCartItem,
  updateCartItem,
} from "../services/cart.service.js";

export const cartRouter = Router();

function validationError() {
  return {
    error: {
      code: "VALIDATION_ERROR",
      message: "Invalid cart request",
    },
  };
}

// Public cart preview, with validated inputs.
// CSRF middleware still applies to this POST request.
cartRouter.post("/preview", async (req, res) => {
  const parsed = previewCartSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json(validationError());
    return;
  }

  res.json(await previewCart(parsed.data.items));
});

// All routes below require login.
cartRouter.use(requireAuth);

// GET /api/cart
cartRouter.get("/", async (req, res) => {
  const userId = req.session.userId!;

  res.json(await getCart(userId));
});

// POST /api/cart/items
cartRouter.post("/items", async (req, res) => {
  const parsed = cartItemSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json(validationError());
    return;
  }

  const result = await addCartItem(req.session.userId!, parsed.data);

  res.status(200).json(result);
});

// PATCH /api/cart/items/:variantId
cartRouter.patch("/items/:variantId", async (req, res) => {
  const id = variantIdSchema.safeParse(req.params.variantId);

  const body = updateQuantitySchema.safeParse(req.body);

  if (!id.success || !body.success) {
    res.status(400).json(validationError());
    return;
  }

  res.json(
    await updateCartItem(req.session.userId!, id.data, body.data.quantity),
  );
});

// DELETE /api/cart/items/:variantId
cartRouter.delete("/items/:variantId", async (req, res) => {
  const id = variantIdSchema.safeParse(req.params.variantId);

  if (!id.success) {
    res.status(400).json(validationError());
    return;
  }

  res.json(await removeCartItem(req.session.userId!, id.data));
});

// POST /api/cart/merge
cartRouter.post("/merge", async (req, res) => {
  const parsed = mergeCartSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json(validationError());
    return;
  }

  res.json(
    await mergeGuestCart(
      req.session.userId!,
      parsed.data.mergeId,
      parsed.data.items,
    ),
  );
});
