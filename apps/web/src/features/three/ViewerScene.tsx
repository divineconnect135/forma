import { Suspense, useEffect, useMemo, useRef, type ComponentRef } from "react";

import { Canvas, useThree } from "@react-three/fiber";

import { Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";

import { Box3, Material, Mesh, MeshStandardMaterial, Vector3 } from "three";

import { ProceduralModel } from "./ProceduralModels";

import { getVariantColor, type DemoModelKind } from "./modelRegistry";

interface ViewerSceneProps {
  kind: DemoModelKind | null;
  modelUrl: string | null;
  color: string;
  resetVersion: number;
  visible: boolean;
  onContextLost: () => void;
}

const INITIAL_CAMERA: [number, number, number] = [3.2, 2.2, 4.4];

// Recolor only materials named "FormaColor".
function recolorMaterial(material: Material, color: string): Material {
  if (!(material instanceof MeshStandardMaterial)) {
    return material;
  }

  if (material.name.toLowerCase() !== "formacolor") {
    return material;
  }

  const clonedMaterial = material.clone();

  clonedMaterial.color.set(getVariantColor(color));

  return clonedMaterial;
}

// Load and normalize an imported GLB model.
function GlbModel({ url, color }: { url: string; color: string }) {
  const { scene } = useGLTF(url);

  const normalized = useMemo(() => {
    const clone = scene.clone(true);

    clone.traverse((object) => {
      // Not every Object3D is a Mesh.
      if (!(object instanceof Mesh)) {
        return;
      }

      object.castShadow = true;
      object.receiveShadow = true;

      // Mesh.material can be one material or an array.
      if (Array.isArray(object.material)) {
        object.material = object.material.map((material) =>
          recolorMaterial(material, color),
        );
      } else {
        object.material = recolorMaterial(object.material, color);
      }
    });

    // Calculate the model's dimensions.
    const box = new Box3().setFromObject(clone);

    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());

    // Scale the longest dimension to 2.3 units.
    const largestSide = Math.max(size.x, size.y, size.z, 0.001);

    const scale = 2.3 / largestSide;

    // Center the imported model.
    const offset: [number, number, number] = [
      -center.x * scale,
      -center.y * scale,
      -center.z * scale,
    ];

    return {
      clone,
      scale,
      offset,
    };
  }, [scene, color]);

  return (
    <group position={normalized.offset}>
      <primitive
        object={normalized.clone}
        scale={normalized.scale}
        dispose={null}
      />
    </group>
  );
}

// Display model loading progress.
function ModelLoading() {
  const { progress } = useProgress();

  return (
    <Html center>
      <div className="min-w-36 rounded-xl bg-white px-4 py-3 text-center text-sm text-neutral-700 shadow-lg">
        <p>Loading 3D model</p>

        <p className="mt-1 font-semibold">{Math.round(progress)}%</p>
      </div>
    </Html>
  );
}

// Camera rotation, zoom, and reset.
function CameraControls({ resetVersion }: { resetVersion: number }) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);

  const camera = useThree((state) => state.camera);

  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (resetVersion === 0) {
      return;
    }

    camera.position.set(...INITIAL_CAMERA);
    camera.lookAt(0, 0, 0);

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }

    invalidate();
  }, [resetVersion, camera, invalidate]);

  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableRotate
      enableZoom
      enablePan={false}
      enableDamping={!reducedMotion}
      dampingFactor={0.08}
      minDistance={2.3}
      maxDistance={7.5}
      minPolarAngle={0.2}
      maxPolarAngle={Math.PI / 1.9}
      target={[0, 0, 0]}
    />
  );
}

// Refresh the scene when it becomes visible.
function VisibilityController({ visible }: { visible: boolean }) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (visible) {
      invalidate();
    }
  }, [visible, invalidate]);

  return null;
}

// Handle WebGL context loss.
function ContextMonitor({ onContextLost }: { onContextLost: () => void }) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const canvas = gl.domElement;

    const handleLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };

    canvas.addEventListener("webglcontextlost", handleLost);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleLost);
    };
  }, [gl, onContextLost]);

  return null;
}

// Main interactive 3D scene.
export default function ViewerScene({
  kind,
  modelUrl,
  color,
  resetVersion,
  visible,
  onContextLost,
}: ViewerSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      frameloop={visible ? "demand" : "never"}
      camera={{
        position: INITIAL_CAMERA,
        fov: 40,
        near: 0.1,
        far: 100,
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      }}
      fallback={
        <div
          role="alert"
          className="flex h-full items-center justify-center p-6 text-center text-sm text-neutral-600"
        >
          3D rendering is unavailable on this device.
        </div>
      }
    >
      {/* Ambient lighting */}
      <ambientLight intensity={1.4} />

      <hemisphereLight args={["#ffffff", "#aaa093", 1.4]} />

      {/* Main light */}
      <directionalLight
        position={[4, 6, 5]}
        intensity={2.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Secondary light */}
      <directionalLight position={[-3, 2, -4]} intensity={0.8} />

      {/* Product models */}
      <Suspense fallback={<ModelLoading />}>
        {modelUrl ? (
          <GlbModel url={modelUrl} color={color} />
        ) : kind ? (
          <ProceduralModel kind={kind} color={color} />
        ) : null}
      </Suspense>

      {/* Ground shadow */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.15, 0]}
        receiveShadow
      >
        <circleGeometry args={[3, 48]} />

        <shadowMaterial transparent opacity={0.17} />
      </mesh>

      {/* Camera interaction */}
      <CameraControls resetVersion={resetVersion} />

      {/* Performance optimization */}
      <VisibilityController visible={visible} />

      {/* WebGL failure monitoring */}
      <ContextMonitor onContextLost={onContextLost} />
    </Canvas>
  );
}
