import { useRef } from "react";
import { Link } from "react-router";

import { ProductViewer } from "../features/three/ProductViewer";
import { useHomeAnimations } from "../hooks/useHomeAnimations";

const featuredProducts = [
  {
    name: "Orbit Desk Lamp",
    slug: "orbit-desk-lamp",
    category: "Lighting",
    price: "$129.00",
    background: "bg-[#e9e1d6]",
    symbol: "◯",
  },
  {
    name: "Arc Lounge Chair",
    slug: "arc-lounge-chair",
    category: "Furniture",
    price: "$349.00",
    background: "bg-[#dfe2d9]",
    symbol: "⌒",
  },
  {
    name: "Modular Desk Tray",
    slug: "modular-desk-tray",
    category: "Accessories",
    price: "$39.00",
    background: "bg-[#e5ddd2]",
    symbol: "▤",
  },
];

const categories = [
  {
    name: "Lighting",
    value: "lighting",
    description: "Light that shapes your space.",
  },
  {
    name: "Furniture",
    value: "furniture",
    description: "Designed for everyday comfort.",
  },
  {
    name: "Accessories",
    value: "accessories",
    description: "Thoughtful finishing details.",
  },
];

export function HomePage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useHomeAnimations(rootRef);

  return (
    <div ref={rootRef} className="space-y-28">
      {/* HERO */}
      <section className="grid min-h-[70vh] items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-7">
          <p
            data-hero-reveal
            className="text-xs font-bold uppercase tracking-[0.25em] text-orange-700"
          >
            Modern living, reimagined
          </p>

          <h1
            data-hero-reveal
            className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-[-0.06em] sm:text-6xl lg:text-7xl"
          >
            Objects worth <span className="font-normal italic">exploring.</span>
          </h1>

          <p
            data-hero-reveal
            className="max-w-lg text-lg leading-8 text-neutral-600"
          >
            Considered design for modern spaces. Explore a curated collection of
            furniture, lighting, and everyday essentials.
          </p>

          <div data-hero-reveal className="flex flex-wrap gap-4">
            <Link
              to="/products"
              className="rounded-full bg-neutral-900 px-7 py-4 text-sm font-semibold text-white transition hover:bg-neutral-700"
            >
              Explore collection
            </Link>

            <Link
              to="/products/orbit-desk-lamp"
              className="rounded-full border border-neutral-300 px-7 py-4 text-sm font-semibold transition hover:bg-white"
            >
              Discover the 3D experience
            </Link>
          </div>

          <p data-hero-reveal className="text-xs text-neutral-500">
            Interactive 3D previews available on selected products.
          </p>
        </div>

        {/* Interactive 3D hero */}
        <div data-hero-reveal>
          <ProductViewer
            productName="Orbit Desk Lamp"
            productSlug="orbit-desk-lamp"
            imageUrl={null}
            modelUrl={null}
            color="Black"
          />
        </div>
      </section>

      {/* FEATURED COLLECTION */}
      <section
        data-scroll-reveal
        className="space-y-10"
        aria-labelledby="featured-heading"
      >
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
              Selected pieces
            </p>

            <h2
              id="featured-heading"
              className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl"
            >
              The featured collection
            </h2>
          </div>

          <Link
            to="/products"
            className="text-sm font-semibold text-orange-700 underline underline-offset-4"
          >
            View all products
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {featuredProducts.map((product) => (
            <Link
              key={product.slug}
              to={`/products/${product.slug}`}
              className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700"
            >
              <div
                className={`flex aspect-[4/3] items-center justify-center ${product.background}`}
              >
                <span
                  aria-hidden="true"
                  className="text-8xl font-light text-neutral-500 transition-transform duration-300 group-hover:scale-110"
                >
                  {product.symbol}
                </span>
              </div>

              <div className="space-y-2 p-6">
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  {product.category}
                </p>

                <h3 className="text-xl font-semibold group-hover:text-orange-700">
                  {product.name}
                </h3>

                <p className="font-medium">{product.price}</p>

                <p className="pt-2 text-sm font-medium text-orange-700">
                  Explore product
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CATEGORY NAVIGATION */}
      <section
        data-scroll-reveal
        aria-labelledby="categories-heading"
        className="space-y-9"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
            Shop by category
          </p>

          <h2
            id="categories-heading"
            className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl"
          >
            Designed around you
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.value}
              to={`/products?category=${category.value}`}
              className="group flex min-h-48 flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-7 transition hover:border-neutral-400 hover:shadow-sm"
            >
              <h3 className="text-2xl font-semibold">{category.name}</h3>

              <div>
                <p className="text-sm text-neutral-600">
                  {category.description}
                </p>

                <p className="mt-4 text-sm font-semibold text-orange-700 group-hover:underline">
                  Explore category
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* BRAND / 3D HIGHLIGHT */}
      <section
        data-scroll-reveal
        className="grid overflow-hidden rounded-3xl bg-neutral-900 text-white lg:grid-cols-2"
        aria-labelledby="experience-heading"
      >
        <div className="space-y-6 p-8 sm:p-12 lg:p-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
            A different perspective
          </p>

          <h2
            id="experience-heading"
            className="text-3xl font-semibold tracking-tight md:text-5xl"
          >
            Explore every angle.
          </h2>

          <p className="max-w-md leading-7 text-neutral-300">
            Rotate, zoom, and inspect selected products before adding them to
            your cart. A more interactive way to discover design.
          </p>

          <Link
            to="/products/arc-lounge-chair"
            className="inline-block rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-200"
          >
            Explore the 3D chair
          </Link>
        </div>

        <div className="flex min-h-72 items-center justify-center bg-[#626153]">
          <div className="flex h-48 w-48 rotate-[-15deg] items-center justify-center rounded-3xl border border-white/30 bg-white/10 shadow-2xl">
            <span
              aria-hidden="true"
              className="text-8xl font-bold tracking-tighter text-white/80"
            >
              F.
            </span>
          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section data-scroll-reveal className="space-y-6 py-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
          Discover Forma
        </p>

        <h2 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
          Everyday essentials.
          <br />
          Considered differently.
        </h2>

        <p className="mx-auto max-w-lg text-neutral-600">
          Explore our complete product collection and find designs for your home
          and workspace.
        </p>

        <Link
          to="/products"
          className="inline-block rounded-full bg-neutral-900 px-8 py-4 text-sm font-semibold text-white hover:bg-neutral-700"
        >
          Shop the collection
        </Link>
      </section>
    </div>
  );
}
