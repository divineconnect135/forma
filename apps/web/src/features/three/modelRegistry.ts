export type DemoModelKind = "lamp" | "chair" | "tray";

const demoModels: Record<string, DemoModelKind> = {
  "orbit-desk-lamp": "lamp",
  "arc-lounge-chair": "chair",
  "modular-desk-tray": "tray",
};

export function getDemoModelKind(slug: string): DemoModelKind | null {
  return demoModels[slug] ?? null;
}

export function getVariantColor(color: string): string {
  const colors: Record<string, string> = {
    black: "#343434",
    ivory: "#e6d8c2",
    brass: "#bd9256",
    cream: "#e4d6bf",
    olive: "#747962",
    sand: "#d3b890",
    charcoal: "#47494c",
    white: "#f1eee8",
    silver: "#a3a8ac",
    walnut: "#76503a",
    "natural oak": "#c39b6c",
  };

  return colors[color.trim().toLowerCase()] ?? "#a89a89";
}

// Only allow local GLB files under /public/models.
// Reject external URLs and directory traversal.
export function getSafeModelUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const valid = /^\/models\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.glb$/.test(
    url,
  );

  return valid ? url : null;
}

export function supports3D(
  productSlug: string,
  modelUrl: string | null,
): boolean {
  return Boolean(getSafeModelUrl(modelUrl) || getDemoModelKind(productSlug));
}
