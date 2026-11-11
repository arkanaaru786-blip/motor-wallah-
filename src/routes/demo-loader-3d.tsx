import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Text } from "@react-three/drei";
import { ArrowLeft } from "lucide-react";
import * as THREE from "three";
import "@/styles/demo-loader-3d.css";

/**
 * Standalone 3D loader preview at /demo-loader-3d (not wired into the site).
 * Eight low-poly vehicles, built from primitives only, orbit a glowing logo.
 */

const BRAND = "#d61f2b";
const METAL = "#d6dce4";
const DARK = "#1b2129";
const GLASS = "#22303d";

type Vec3 = [number, number, number];

function Panel({
  args,
  position,
  color = METAL,
  metalness = 0.55,
  roughness = 0.35,
}: {
  args: Vec3;
  position: Vec3;
  color?: string;
  metalness?: number;
  roughness?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  );
}

function Wheel({
  position,
  radius = 0.3,
  width = 0.18,
  accent = false,
}: {
  position: Vec3;
  radius?: number;
  width?: number;
  accent?: boolean;
}) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[radius, radius, width, 16]} />
        <meshStandardMaterial color={accent ? BRAND : DARK} roughness={0.7} metalness={0.25} />
      </mesh>
      <mesh position={[0, width / 2 + 0.01, 0]}>
        <cylinderGeometry args={[radius * 0.45, radius * 0.45, 0.02, 12]} />
        <meshStandardMaterial color="#e9edf2" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Car() {
  return (
    <group>
      <Panel args={[2.1, 0.46, 0.92]} position={[0, 0.5, 0]} />
      <Panel args={[1.05, 0.44, 0.84]} position={[-0.12, 0.92, 0]} color={GLASS} roughness={0.15} />
      <Wheel position={[0.66, 0.26, 0.5]} />
      <Wheel position={[0.66, 0.26, -0.5]} />
      <Wheel position={[-0.66, 0.26, 0.5]} />
      <Wheel position={[-0.66, 0.26, -0.5]} />
      <Panel args={[0.14, 0.12, 0.7]} position={[1.06, 0.55, 0]} color={BRAND} metalness={0.3} />
    </group>
  );
}

function Taxi() {
  return (
    <group>
      <Car />
      <Panel args={[0.42, 0.16, 0.26]} position={[-0.12, 1.22, 0]} color={BRAND} metalness={0.2} />
    </group>
  );
}

function Bike() {
  return (
    <group>
      <mesh position={[0.62, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.32, 0.075, 10, 22]} />
        <meshStandardMaterial color={DARK} roughness={0.75} />
      </mesh>
      <mesh position={[-0.62, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.32, 0.075, 10, 22]} />
        <meshStandardMaterial color={DARK} roughness={0.75} />
      </mesh>
      <Panel args={[1.15, 0.1, 0.14]} position={[0, 0.6, 0]} color={METAL} />
      <Panel args={[0.42, 0.12, 0.24]} position={[-0.22, 0.76, 0]} color={DARK} metalness={0.2} />
      <Panel args={[0.34, 0.16, 0.3]} position={[0.3, 0.78, 0]} color={BRAND} metalness={0.3} />
      <Panel args={[0.06, 0.34, 0.06]} position={[0.55, 0.62, 0]} color={DARK} />
      <Panel args={[0.08, 0.08, 0.56]} position={[0.58, 0.82, 0]} color={DARK} />
    </group>
  );
}

function Auto() {
  return (
    <group>
      <Panel args={[1.15, 0.34, 0.88]} position={[-0.05, 0.44, 0]} />
      <Panel args={[0.9, 0.66, 0.84]} position={[-0.18, 0.9, 0]} color={GLASS} roughness={0.2} />
      <Panel args={[1.05, 0.1, 0.9]} position={[-0.14, 1.28, 0]} color="#f2c14b" metalness={0.2} />
      <Panel args={[0.36, 0.36, 0.8]} position={[0.62, 0.62, 0]} color="#2f8f4e" metalness={0.2} />
      <Wheel position={[0.82, 0.24, 0]} radius={0.24} width={0.14} />
      <Wheel position={[-0.72, 0.24, 0.42]} radius={0.24} width={0.14} />
      <Wheel position={[-0.72, 0.24, -0.42]} radius={0.24} width={0.14} />
    </group>
  );
}

function Scv() {
  return (
    <group>
      <Panel args={[0.95, 0.62, 0.92]} position={[0.58, 0.72, 0]} />
      <Panel args={[0.5, 0.34, 0.84]} position={[0.62, 1.08, 0]} color={GLASS} roughness={0.2} />
      <Panel args={[1.35, 0.24, 0.92]} position={[-0.42, 0.52, 0]} />
      <Panel args={[1.35, 0.32, 0.06]} position={[-0.42, 0.7, 0.45]} color={METAL} metalness={0.4} />
      <Panel args={[1.35, 0.32, 0.06]} position={[-0.42, 0.7, -0.45]} color={METAL} metalness={0.4} />
      <Wheel position={[0.72, 0.26, 0.5]} />
      <Wheel position={[0.72, 0.26, -0.5]} />
      <Wheel position={[-0.66, 0.26, 0.5]} />
      <Wheel position={[-0.66, 0.26, -0.5]} />
    </group>
  );
}

function Truck() {
  return (
    <group>
      <Panel args={[1.0, 0.9, 1.05]} position={[1.0, 0.92, 0]} color={BRAND} metalness={0.45} />
      <Panel args={[0.55, 0.36, 0.95]} position={[1.02, 1.36, 0]} color={GLASS} roughness={0.2} />
      <Panel args={[2.6, 1.15, 1.1]} position={[-0.75, 1.02, 0]} color={METAL} metalness={0.4} />
      <Panel args={[2.6, 0.06, 1.12]} position={[-0.75, 1.62, 0]} color="#aeb7c2" metalness={0.6} />
      <Wheel position={[1.05, 0.3, 0.55]} radius={0.32} />
      <Wheel position={[1.05, 0.3, -0.55]} radius={0.32} />
      <Wheel position={[-0.6, 0.3, 0.55]} radius={0.32} />
      <Wheel position={[-0.6, 0.3, -0.55]} radius={0.32} />
      <Wheel position={[-1.6, 0.3, 0.55]} radius={0.32} />
      <Wheel position={[-1.6, 0.3, -0.55]} radius={0.32} />
    </group>
  );
}

function Bus() {
  return (
    <group>
      <Panel args={[3.1, 1.25, 1.06]} position={[0, 1.02, 0]} color="#f4f6f9" metalness={0.35} />
      <Panel args={[2.5, 0.4, 1.08]} position={[-0.1, 1.28, 0]} color={GLASS} roughness={0.15} />
      <Panel args={[0.08, 0.5, 1.08]} position={[1.56, 0.9, 0]} color={BRAND} metalness={0.3} />
      <Wheel position={[1.1, 0.3, 0.54]} radius={0.3} />
      <Wheel position={[1.1, 0.3, -0.54]} radius={0.3} />
      <Wheel position={[-1.05, 0.3, 0.54]} radius={0.3} />
      <Wheel position={[-1.05, 0.3, -0.54]} radius={0.3} />
    </group>
  );
}

function Tractor() {
  return (
    <group>
      <Panel args={[1.5, 0.38, 0.72]} position={[0, 0.72, 0]} color="#2f8f4e" metalness={0.3} />
      <Panel args={[0.72, 0.5, 0.66]} position={[-0.1, 1.12, 0]} color={GLASS} roughness={0.2} />
      <Panel args={[0.8, 0.08, 0.7]} position={[-0.1, 1.4, 0]} color="#1f7a3f" />
      <Wheel position={[-0.5, 0.5, 0.42]} radius={0.5} width={0.24} accent />
      <Wheel position={[-0.5, 0.5, -0.42]} radius={0.5} width={0.24} accent />
      <Wheel position={[0.78, 0.3, 0.36]} radius={0.3} width={0.16} />
      <Wheel position={[0.78, 0.3, -0.36]} radius={0.3} width={0.16} />
      <Panel args={[0.06, 0.5, 0.06]} position={[0.5, 1.05, 0.22]} color={DARK} />
    </group>
  );
}

const VEHICLES = [Car, Bike, Auto, Truck, Bus, Tractor, Taxi, Scv];

function Orbit() {
  const ring = useRef<THREE.Group>(null);
  const items = useRef<(THREE.Group | null)[]>([]);
  const { viewport } = useThree();
  const fit = Math.min(1, Math.max(0.5, viewport.aspect * 0.82));

  useFrame((state, delta) => {
    if (!ring.current) return;
    ring.current.rotation.y += delta * 0.26;
    const yaw = ring.current.rotation.y;
    items.current.forEach((item, index) => {
      if (!item) return;
      item.rotation.y = -yaw;
      item.position.y = Math.sin(state.clock.elapsedTime * 0.9 + index) * 0.055;
    });
  });

  return (
    <group scale={fit}>
      <group ref={ring}>
        {VEHICLES.map((Vehicle, index) => {
          const angle = (index / VEHICLES.length) * Math.PI * 2;
          return (
            <group
              key={index}
              position={[Math.cos(angle) * 3.9, 0, Math.sin(angle) * 3.9]}
              rotation={[0, -angle + Math.PI / 2, 0]}
            >
              <group ref={(node) => { items.current[index] = node; }}>
                <Vehicle />
              </group>
            </group>
          );
        })}
      </group>
    </group>
  );
}

function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(0, 0.35, 0);
  }, [camera]);
  return null;
}

function Scene() {
  const textColor = useMemo(() => new THREE.Color("#4a5361"), []);
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 2.9, 11.4], fov: 42 }}
      // preserveDrawingBuffer keeps the scene visible in screenshots and previews.
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
    >
      <CameraRig />
      <color attach="background" args={["#f1f4f8"]} />
      <fog attach="fog" args={["#f1f4f8", 13, 24]} />
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#ffffff", "#cfd6df", 0.6]} />
      <directionalLight position={[6, 10, 7]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-7, 4, -6]} intensity={0.5} color="#c8d4e6" />

      <Suspense fallback={null}>
        <Orbit />
        <Text
          position={[0, -2.35, 0]}
          font="/fonts/oswald-700.ttf"
          fontSize={0.3}
          letterSpacing={0.22}
          color={textColor}
          anchorX="center"
          anchorY="middle"
        >
          LOADING YOUR MARKETPLACE...
        </Text>
      </Suspense>

      <ContactShadows position={[0, -1.15, 0]} opacity={0.28} scale={16} blur={2.8} far={5} resolution={512} />
    </Canvas>
  );
}

export const Route = createFileRoute("/demo-loader-3d")({
  head: () => ({
    meta: [
      { title: "3D Loader Demo | Motor Wallah" },
      { name: "description", content: "Preview of the Motor Wallah 3D loading screen." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DemoLoader3dPage,
});

function DemoLoader3dPage() {
  const [mounted, setMounted] = useState(false);

  // Canvas is client-only; also suppress the site consent banner while open.
  useEffect(() => {
    setMounted(true);
    const root = document.documentElement;
    root.classList.add("mw-demo-open");
    return () => root.classList.remove("mw-demo-open");
  }, []);

  return (
    <div className="mw3d-page">
      <div className="mw3d-frame">
        <div className="mw3d-canvas">{mounted ? <Scene /> : <div className="mw3d-placeholder" />}</div>

        <div className="mw3d-core" aria-hidden="true">
          <span className="mw3d-core__glow" />
          <img src="/images/MW-logo.png" alt="" width={612} height={408} decoding="async" />
        </div>

        <div className="mw3d-footer">
          <Link to="/" className="mw3d-close">
            <ArrowLeft size={15} aria-hidden="true" /> Close Demo
          </Link>
        </div>
      </div>
    </div>
  );
}
