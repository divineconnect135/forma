export type ProductCategory = "lighting" | "furniture" | "accessories";

export type ProductSort = "newest" | "price-asc" | "price-desc";

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: ProductCategory;
  priceCents: number;
  currency: "USD";
  images: string[];
  modelUrl: string | null;
  featured: boolean;
}

export interface ProductVariant {
  _id: string;
  sku: string;
  color: string;
  size: string | null;
  availableQuantity: number;
  inStock: boolean;
}

export interface ProductDetail extends Product {
  variants: ProductVariant[];
}

export interface ProductFilters {
  page: number;
  limit: number;
  search: string;
  category: string;
  sort: ProductSort;
  minPriceCents?: number;
  maxPriceCents?: number;
}

export interface ProductListResponse {
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ProductDetailResponse {
  data: ProductDetail;
}

export class ProductNotFoundError extends Error {
  constructor() {
    super("Product not found");
    this.name = "ProductNotFoundError";
  }
}

export async function fetchProducts(
  filters: ProductFilters,
  signal?: AbortSignal,
): Promise<ProductListResponse> {
  const params = new URLSearchParams({
    page: String(filters.page),
    limit: String(filters.limit),
    sort: filters.sort,
  });

  if (filters.search) {
    params.set("search", filters.search);
  }

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.minPriceCents !== undefined) {
    params.set("minPriceCents", String(filters.minPriceCents));
  }

  if (filters.maxPriceCents !== undefined) {
    params.set("maxPriceCents", String(filters.maxPriceCents));
  }

  const response = await fetch(`/api/products?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Unable to load products (HTTP ${response.status})`);
  }

  return (await response.json()) as ProductListResponse;
}

export async function fetchProductBySlug(
  slug: string,
  signal?: AbortSignal,
): Promise<ProductDetail> {
  const response = await fetch(`/api/products/${encodeURIComponent(slug)}`, {
    signal,
  });

  if (response.status === 404) {
    throw new ProductNotFoundError();
  }

  if (!response.ok) {
    throw new Error(`Unable to load product (HTTP ${response.status})`);
  }

  const result = (await response.json()) as ProductDetailResponse;

  return result.data;
}
