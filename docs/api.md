# API — Phase 1

- `GET /api/health/live` -> 200 `{ "status": "ok" }` whenever Express responds.
- `GET /api/health` -> 200 `{ "status": "ok", "database": "connected" }` if MongoDB is ready; 503 with `status: "degraded"` otherwise.
- Unknown `/api/*` -> 404 `{ "error": { "code": "NOT_FOUND", "message": "API route not found" } }`.

Product, authentication, cart, checkout, order, and admin endpoints follow in later phases.

GET /api/products/:slug

Access: Public

Success: 200
{
"data": {
"...productFields": "...",
"variants": [
{
"_id": "...",
"sku": "ORBIT-BLACK",
"color": "Black",
"size": null,
"availableQuantity": 8,
"inStock": true
}
]
}
}

Invalid slug: 400 INVALID_SLUG
Missing or inactive product: 404 PRODUCT_NOT_FOUND
