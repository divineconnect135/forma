import type { DemoModelKind } from "./modelRegistry";
import { getVariantColor } from "./modelRegistry";

interface ModelProps {
  color: string;
}

function OrbitLamp({ color }: ModelProps) {
  const finish = getVariantColor(color);

  return (
    <group>
      {/* Circular base */}
      <mesh position={[0, -1.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.56, 0.56, 0.1, 48]} />
        <meshStandardMaterial color={finish} metalness={0.7} roughness={0.28} />
      </mesh>

      {/* Main vertical stem */}
      <mesh position={[0, -0.38, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.065, 1.3, 24]} />
        <meshStandardMaterial color={finish} metalness={0.65} roughness={0.3} />
      </mesh>

      {/* Angled upper arm */}
      <mesh position={[0.13, 0.36, 0]} rotation={[0, 0, -0.5]} castShadow>
        <cylinderGeometry args={[0.052, 0.052, 0.55, 24]} />
        <meshStandardMaterial color={finish} metalness={0.7} roughness={0.25} />
      </mesh>

      {/* Rotating joint detail */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <sphereGeometry args={[0.09, 24, 24]} />
        <meshStandardMaterial color="#787878" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Lamp shade */}
      <mesh position={[0.32, 0.74, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.47, 0.53, 48, 1, true]} />
        <meshStandardMaterial
          color={finish}
          metalness={0.55}
          roughness={0.35}
          side={2}
        />
      </mesh>

      {/* Top shade cap */}
      <mesh position={[0.32, 1.015, 0]} castShadow>
        <cylinderGeometry args={[0.255, 0.255, 0.025, 48]} />
        <meshStandardMaterial
          color={finish}
          metalness={0.55}
          roughness={0.35}
        />
      </mesh>

      {/* Light bulb */}
      <mesh position={[0.32, 0.51, 0]}>
        <sphereGeometry args={[0.155, 24, 24]} />
        <meshStandardMaterial
          color="#fff4da"
          emissive="#ffcf7e"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
}

function ArcChair({ color }: ModelProps) {
  const upholstery = getVariantColor(color);

  return (
    <group>
      {/* Four wooden legs */}
      {[-0.48, 0.48].map((x) =>
        [-0.43, 0.43].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, -0.73, z]} castShadow>
            <cylinderGeometry args={[0.065, 0.085, 0.85, 16]} />
            <meshStandardMaterial color="#6d4a37" roughness={0.62} />
          </mesh>
        )),
      )}

      {/* Seat structure */}
      <mesh position={[0, -0.27, 0]} castShadow>
        <boxGeometry args={[1.38, 0.15, 1.18]} />
        <meshStandardMaterial color="#654735" roughness={0.65} />
      </mesh>

      {/* Upholstered seat */}
      <mesh position={[0, -0.13, 0]} castShadow>
        <boxGeometry args={[1.3, 0.23, 1.1]} />
        <meshStandardMaterial color={upholstery} roughness={0.92} />
      </mesh>

      {/* Back cushion */}
      <mesh position={[0, 0.56, -0.5]} rotation={[-0.16, 0, 0]} castShadow>
        <boxGeometry args={[1.32, 1.4, 0.25]} />
        <meshStandardMaterial color={upholstery} roughness={0.9} />
      </mesh>

      {/* Armrests */}
      {[-0.65, 0.65].map((x) => (
        <mesh key={x} position={[x, 0.1, -0.02]} castShadow>
          <boxGeometry args={[0.13, 0.14, 1.1]} />
          <meshStandardMaterial color="#775540" roughness={0.62} />
        </mesh>
      ))}
    </group>
  );
}

function ModularTray({ color }: ModelProps) {
  const finish = getVariantColor(color);

  return (
    <group position={[0, -0.55, 0]}>
      {/* Tray base */}
      <mesh position={[0, -0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.25, 0.15, 1.45]} />
        <meshStandardMaterial color={finish} roughness={0.65} />
      </mesh>

      {/* Raised outer edges */}
      {[-0.71, 0.71].map((z) => (
        <mesh key={`horizontal-${z}`} position={[0, -0.1, z]} castShadow>
          <boxGeometry args={[2.25, 0.3, 0.08]} />
          <meshStandardMaterial color={finish} roughness={0.65} />
        </mesh>
      ))}

      {[-1.085, 1.085].map((x) => (
        <mesh key={`vertical-${x}`} position={[x, -0.1, 0]} castShadow>
          <boxGeometry args={[0.08, 0.3, 1.45]} />
          <meshStandardMaterial color={finish} roughness={0.65} />
        </mesh>
      ))}

      {/* Compartment divider */}
      <mesh position={[0.23, -0.1, 0]} castShadow>
        <boxGeometry args={[0.07, 0.3, 1.37]} />
        <meshStandardMaterial color={finish} roughness={0.65} />
      </mesh>

      {/* Decorative organizer compartments */}
      <mesh position={[-0.44, -0.16, 0.16]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.18, 32]} />
        <meshStandardMaterial color="#b6a28b" roughness={0.7} />
      </mesh>

      <mesh position={[0.66, -0.16, -0.17]} castShadow>
        <boxGeometry args={[0.6, 0.2, 0.56]} />
        <meshStandardMaterial color="#e4d8c7" roughness={0.7} />
      </mesh>
    </group>
  );
}

export function ProceduralModel({
  kind,
  color,
}: {
  kind: DemoModelKind;
  color: string;
}) {
  switch (kind) {
    case "lamp":
      return <OrbitLamp color={color} />;

    case "chair":
      return <ArcChair color={color} />;

    case "tray":
      return <ModularTray color={color} />;
  }
}
