import { useEffect, useState, type FormEvent } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Link, useNavigate, useParams } from "react-router";

import {
  createAdminProduct,
  createAdminVariant,
  getAdminProduct,
  updateAdminProduct,
  updateAdminVariant,
  type AdminVariant,
  type ProductInput,
  type VariantInput,
} from "../lib/admin";

const emptyProduct: ProductInput = {
  name: "",
  slug: "",
  description: "",
  category: "lighting",
  priceCents: 100,
  featured: false,
  images: [],
  modelUrl: null,
  status: "archived",
};

function VariantEditor({
  variant,
  onSaved,
}: {
  variant: AdminVariant;
  onSaved: () => void;
}) {
  const [color, setColor] = useState(variant.color);
  const [size, setSize] = useState(variant.size ?? "");
  const [active, setActive] = useState(variant.active);

  const mutation = useMutation({
    mutationFn: () =>
      updateAdminVariant(variant.id, {
        color,
        size: size.trim() || null,
        active,
      }),
    onSuccess: onSaved,
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
      className="grid gap-3 rounded-xl border border-neutral-200 p-4 sm:grid-cols-4"
    >
      <div>
        <p className="text-xs text-neutral-500">SKU</p>
        <p className="font-mono text-sm">{variant.sku}</p>
        <p className="text-xs text-neutral-500">
          Available: {variant.availableQuantity}
        </p>
      </div>

      <label className="text-sm">
        Color
        <input
          value={color}
          onChange={(event) => setColor(event.target.value)}
          required
          className="mt-1 w-full rounded-lg border p-2"
        />
      </label>

      <label className="text-sm">
        Size
        <input
          value={size}
          onChange={(event) => setSize(event.target.value)}
          className="mt-1 w-full rounded-lg border p-2"
        />
      </label>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Active
        </label>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Save variant
        </button>

        {mutation.isError && (
          <p role="alert" className="text-xs text-red-700">
            {mutation.error.message}
          </p>
        )}
      </div>
    </form>
  );
}

export function AdminProductEditorPage() {
  const { productId } = useParams<"productId">();

  const creating = !productId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<ProductInput>(emptyProduct);

  const [imagesText, setImagesText] = useState("");

  const [newVariant, setNewVariant] = useState<VariantInput>({
    sku: "",
    color: "",
    size: null,
  });

  const productQuery = useQuery({
    queryKey: ["admin", "product", productId],
    queryFn: () => getAdminProduct(productId!),
    enabled: !creating,
    retry: false,
  });

  useEffect(() => {
    const product = productQuery.data?.data;
    if (!product) return;

    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description,
      category: product.category,
      priceCents: product.priceCents,
      featured: product.featured,
      images: product.images,
      modelUrl: product.modelUrl,
      status: product.status,
    });

    setImagesText(product.images.join("\n"));
  }, [productQuery.data]);

  function update<K extends keyof ProductInput>(
    field: K,
    value: ProductInput[K],
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  const saveProduct = useMutation({
    mutationFn: (input: ProductInput) =>
      creating
        ? createAdminProduct(input)
        : updateAdminProduct(productId!, input),

    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ["admin"],
      });

      if (creating) {
        navigate(`/admin/products/${result.data.id}`);
      }
    },
  });

  const addVariant = useMutation({
    mutationFn: () => createAdminVariant(productId!, newVariant),

    onSuccess: async () => {
      setNewVariant({
        sku: "",
        color: "",
        size: null,
      });

      await queryClient.invalidateQueries({
        queryKey: ["admin"],
      });
    },
  });

  function submitProduct(event: FormEvent) {
    event.preventDefault();

    saveProduct.mutate({
      ...form,
      images: imagesText
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
      modelUrl: form.modelUrl?.trim() || null,
    });
  }

  if (!creating && productQuery.isPending) {
    return <p role="status">Loading product...</p>;
  }

  if (!creating && productQuery.isError) {
    return <p role="alert">Unable to load this product.</p>;
  }

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <Link to="/admin/products" className="text-sm text-orange-700 underline">
        Back to products
      </Link>

      <h1 className="text-3xl font-semibold">
        {creating ? "Create Product" : "Edit Product"}
      </h1>

      <form
        onSubmit={submitProduct}
        className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Product name
            <input
              required
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              className="mt-1 w-full rounded-lg border p-3"
            />
          </label>

          <label className="text-sm">
            Slug
            <input
              required
              value={form.slug}
              onChange={(event) => update("slug", event.target.value)}
              placeholder="modern-desk-lamp"
              className="mt-1 w-full rounded-lg border p-3"
            />
          </label>

          <label className="text-sm">
            Category
            <input
              required
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
              className="mt-1 w-full rounded-lg border p-3"
            />
          </label>

          <label className="text-sm">
            Price in USD cents
            <input
              required
              type="number"
              min="1"
              step="1"
              value={form.priceCents}
              onChange={(event) =>
                update("priceCents", Number(event.target.value))
              }
              className="mt-1 w-full rounded-lg border p-3"
            />
          </label>
        </div>

        <label className="block text-sm">
          Description
          <textarea
            required
            rows={5}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            className="mt-1 w-full rounded-lg border p-3"
          />
        </label>

        <label className="block text-sm">
          Image URLs (one per line)
          <textarea
            rows={4}
            value={imagesText}
            onChange={(event) => setImagesText(event.target.value)}
            className="mt-1 w-full rounded-lg border p-3"
          />
        </label>

        <label className="block text-sm">
          3D model URL (optional)
          <input
            value={form.modelUrl ?? ""}
            onChange={(event) => update("modelUrl", event.target.value)}
            placeholder="/models/product.glb"
            className="mt-1 w-full rounded-lg border p-3"
          />
        </label>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(event) => update("featured", event.target.checked)}
            />
            Featured
          </label>

          <label className="text-sm">
            Status
            <select
              value={form.status}
              onChange={(event) =>
                update("status", event.target.value as ProductInput["status"])
              }
              className="ml-2 rounded-lg border p-2"
            >
              <option value="archived">Archived</option>
              <option value="active">Active</option>
            </select>
          </label>
        </div>

        {saveProduct.isError && (
          <p role="alert" className="text-sm text-red-700">
            {saveProduct.error.message}
          </p>
        )}

        {saveProduct.isSuccess && !creating && (
          <p role="status" className="text-sm text-green-800">
            Product saved.
          </p>
        )}

        <button
          type="submit"
          disabled={saveProduct.isPending}
          className="rounded-xl bg-neutral-900 px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          {saveProduct.isPending
            ? "Saving..."
            : creating
              ? "Create Product"
              : "Save Changes"}
        </button>
      </form>

      {!creating && productQuery.data && (
        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">Product Variants</h2>

          {productQuery.data.data.variants.map((variant) => (
            <VariantEditor
              key={variant.id}
              variant={variant}
              onSaved={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["admin"],
                })
              }
            />
          ))}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              addVariant.mutate();
            }}
            className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6"
          >
            <h3 className="text-lg font-semibold">Add Variant</h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <input
                required
                placeholder="SKU"
                aria-label="New variant SKU"
                value={newVariant.sku}
                onChange={(event) =>
                  setNewVariant((value) => ({
                    ...value,
                    sku: event.target.value,
                  }))
                }
                className="rounded-lg border p-3"
              />

              <input
                required
                placeholder="Color"
                aria-label="New variant color"
                value={newVariant.color}
                onChange={(event) =>
                  setNewVariant((value) => ({
                    ...value,
                    color: event.target.value,
                  }))
                }
                className="rounded-lg border p-3"
              />

              <input
                placeholder="Size (optional)"
                aria-label="New variant size"
                value={newVariant.size ?? ""}
                onChange={(event) =>
                  setNewVariant((value) => ({
                    ...value,
                    size: event.target.value || null,
                  }))
                }
                className="rounded-lg border p-3"
              />
            </div>

            <p className="text-sm text-neutral-600">
              New variants start with zero stock. Use Inventory Management to
              add stock.
            </p>

            {addVariant.isError && (
              <p role="alert" className="text-sm text-red-700">
                {addVariant.error.message}
              </p>
            )}

            <button
              type="submit"
              disabled={addVariant.isPending}
              className="rounded-lg bg-neutral-900 px-5 py-3 text-sm text-white disabled:opacity-50"
            >
              Add Variant
            </button>
          </form>
        </section>
      )}
    </section>
  );
}
