import { useState } from "react";
import { Link } from "react-router";

import { formatUsd } from "../../lib/money";
import type { Product } from "../../lib/products";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const image = product.images[0];

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link
        to={`/products/${product.slug}`}
        className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700"
      >
        <div className="aspect-4/3 overflow-hidden bg-[#e9e4dd]">
          {image && !imageFailed ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-500">
              <span
                aria-hidden="true"
                className="text-6xl font-semibold tracking-tighter text-neutral-400"
              >
                F.
              </span>

              <span className="text-xs uppercase tracking-widest">
                Image coming soon
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
              {product.category}
            </p>

            {product.featured && (
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-800">
                Featured
              </span>
            )}
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 group-hover:text-orange-700">
            {product.name}
          </h2>

          <p className="line-clamp-2 min-h-10 text-sm leading-5 text-neutral-600">
            {product.description}
          </p>

          <p className="pt-2 text-lg font-semibold text-neutral-900">
            {formatUsd(product.priceCents)}
          </p>

          <span className="inline-block pt-2 text-sm font-medium text-orange-700">
            View product
          </span>
        </div>
      </Link>
    </article>
  );
}
