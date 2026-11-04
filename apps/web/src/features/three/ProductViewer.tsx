import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getDemoModelKind, getSafeModelUrl, supports3D } from "./modelRegistry";

const ViewerScene = lazy(() => import("./ViewerScene"));

interface ProductViewerProps {
  productName: string;
  productSlug: string;
  imageUrl: string | null;
  modelUrl: string | null;
  color: string;
}

interface BoundaryProps {
  children: ReactNode;
  onError: () => void;
}

interface BoundaryState {
  hasError: boolean;
}

class ThreeErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");

    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");

    return Boolean(context);
  } catch {
    return false;
  }
}

// Static visual remains available without JavaScript 3D.
function ProductPoster({
  name,
  imageUrl,
  productSlug,
}: {
  name: string;
  imageUrl: string | null;
  productSlug: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    );
  }

  const kind = getDemoModelKind(productSlug);

  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#e9e4dd] p-6">
      <svg
        viewBox="0 0 320 320"
        className="h-full max-h-72 w-full max-w-72"
        role="img"
        aria-label={`${name} illustrative preview`}
      >
        <ellipse
          cx="160"
          cy="275"
          rx="105"
          ry="14"
          fill="#b9aa98"
          opacity="0.35"
        />

        {kind === "lamp" ? (
          <g
            fill="none"
            stroke="#62554b"
            strokeWidth="12"
            strokeLinecap="round"
          >
            <ellipse
              cx="147"
              cy="264"
              rx="59"
              ry="10"
              fill="#76685b"
              stroke="none"
            />
            <path d="M147 251 V140 L192 96" />
            <path
              d="M165 75 L213 75 L239 137 L137 137 Z"
              fill="#76685b"
              stroke="none"
            />
            <circle cx="189" cy="137" r="11" fill="#ffdf9a" stroke="none" />
          </g>
        ) : kind === "chair" ? (
          <g fill="#8b806f">
            <rect x="83" y="128" width="154" height="104" rx="20" />
            <rect
              x="85"
              y="83"
              width="150"
              height="103"
              rx="23"
              fill="#a89a86"
            />
            <rect x="93" y="218" width="16" height="51" rx="5" fill="#69503e" />
            <rect
              x="211"
              y="218"
              width="16"
              height="51"
              rx="5"
              fill="#69503e"
            />
          </g>
        ) : kind === "tray" ? (
          <g>
            <rect
              x="65"
              y="127"
              width="190"
              height="112"
              rx="13"
              fill="#9b8061"
            />
            <rect
              x="76"
              y="135"
              width="168"
              height="91"
              rx="6"
              fill="#d2b790"
            />
            <path d="M168 135 V226" stroke="#9b8061" strokeWidth="8" />
            <circle cx="119" cy="181" r="25" fill="#a48f79" />
          </g>
        ) : (
          <text
            x="160"
            y="185"
            textAnchor="middle"
            fontSize="88"
            fontWeight="700"
            fill="#9e9080"
          >
            F.
          </text>
        )}
      </svg>

      <p className="text-center text-xs uppercase tracking-widest text-neutral-600">
        Illustrative preview
      </p>
    </div>
  );
}

export function ProductViewer({
  productName,
  productSlug,
  imageUrl,
  modelUrl,
  color,
}: ProductViewerProps) {
  const [show3D, setShow3D] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const [viewerError, setViewerError] = useState("");
  const [visible, setVisible] = useState(true);

  const viewerRef = useRef<HTMLDivElement>(null);

  const safeModelUrl = getSafeModelUrl(modelUrl);

  const kind = getDemoModelKind(productSlug);

  const has3D = supports3D(productSlug, modelUrl);

  useEffect(() => {
    if (!show3D || !viewerRef.current) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry?.isIntersecting ?? true);
      },
      { threshold: 0.01 },
    );

    observer.observe(viewerRef.current);

    return () => observer.disconnect();
  }, [show3D]);

  const handleViewerFailure = useCallback(() => {
    setViewerError(
      "The 3D viewer could not load. The static product preview is still available.",
    );
    setShow3D(false);
  }, []);

  function activate3D() {
    if (!isWebGLAvailable()) {
      setViewerError(
        "WebGL is not available in this browser. Use the static product preview instead.",
      );
      return;
    }

    setViewerError("");
    setVisible(true);
    setShow3D(true);
  }

  const poster = (
    <ProductPoster
      name={productName}
      imageUrl={imageUrl}
      productSlug={productSlug}
    />
  );

  return (
    <section aria-label={`${productName} product viewer`} className="space-y-4">
      <div
        ref={viewerRef}
        className="relative aspect-square overflow-hidden rounded-3xl bg-[#e9e4dd]"
      >
        {show3D && has3D ? (
          <ThreeErrorBoundary onError={handleViewerFailure}>
            <Suspense
              fallback={
                <div
                  role="status"
                  className="flex h-full items-center justify-center text-sm text-neutral-600"
                >
                  Preparing 3D viewer...
                </div>
              }
            >
              <div className="h-full w-full touch-none">
                <ViewerScene
                  kind={kind}
                  modelUrl={safeModelUrl}
                  color={color}
                  resetVersion={resetVersion}
                  visible={visible}
                  onContextLost={handleViewerFailure}
                />
              </div>
            </Suspense>
          </ThreeErrorBoundary>
        ) : (
          poster
        )}
      </div>

      {viewerError && (
        <p role="alert" className="text-sm text-red-700">
          {viewerError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {has3D && !show3D && (
          <button
            type="button"
            onClick={activate3D}
            className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700"
          >
            View in 3D
          </button>
        )}

        {has3D && show3D && (
          <>
            <button
              type="button"
              onClick={() => setResetVersion((value) => value + 1)}
              className="rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-medium hover:bg-neutral-50"
            >
              Reset view
            </button>

            <button
              type="button"
              onClick={() => setShow3D(false)}
              className="rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-medium hover:bg-neutral-50"
            >
              Show product image
            </button>
          </>
        )}

        {has3D && show3D && (
          <span className="text-xs text-neutral-600">
            Drag to rotate · Scroll or pinch to zoom
          </span>
        )}

        {!has3D && (
          <p className="text-sm text-neutral-500">
            3D model not available for this product.
          </p>
        )}
      </div>
    </section>
  );
}
