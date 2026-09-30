"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, ContactShadows, PresentationControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import HeroFallback from "@/components/home/HeroFallback";

const PAINT = "#f4f7fb";
const STRIPE = "#195ef0";
const GLASS = "#10243f";

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function makeTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  draw(ctx, w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function Wheel({ x, z, dual = false }: { x: number; z: number; dual?: boolean }) {
  const offsets = dual ? [0, z > 0 ? -0.15 : 0.15] : [0];
  return (
    <>
      {offsets.map((offset) => (
        <group key={offset} position={[x, 0.3, z + offset]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.3, 0.14, 28]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.045, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.15, 20]} />
            <meshStandardMaterial color="#d5dee8" metalness={0.8} roughness={0.22} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.16, 12]} />
            <meshStandardMaterial color="#8d98a6" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Coach({ logo }: { logo: THREE.Texture }) {
  const paneXs = [-1.72, -1.28, -0.84, -0.4, 0.04, 0.48, 0.92];
  return (
    <group position={[-0.35, 0, -0.05]}>
      <RoundedBox args={[4.55, 1.28, 1.08]} radius={0.2} smoothness={4} position={[0, 0.98, 0]}>
        <meshPhysicalMaterial color={PAINT} roughness={0.32} metalness={0.06} clearcoat={0.55} clearcoatRoughness={0.4} />
      </RoundedBox>

      {[-0.545, 0.545].map((z) => (
        <mesh key={`stripe-${z}`} position={[-0.15, 0.7, z]}>
          <boxGeometry args={[3.15, 0.055, 0.015]} />
          <meshStandardMaterial color={STRIPE} roughness={0.35} metalness={0.12} />
        </mesh>
      ))}

      {paneXs.map((x) => (
        <mesh key={`near-${x}`} position={[x, 1.26, 0.548]}>
          <planeGeometry args={[0.36, 0.4]} />
          <meshStandardMaterial color={GLASS} metalness={0.55} roughness={0.08} />
        </mesh>
      ))}
      {paneXs.map((x) => (
        <mesh key={`far-${x}`} position={[x, 1.26, -0.548]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.36, 0.4]} />
          <meshStandardMaterial color={GLASS} metalness={0.55} roughness={0.08} />
        </mesh>
      ))}

      <mesh position={[1.58, 0.98, 0.55]}>
        <planeGeometry args={[0.46, 0.86]} />
        <meshStandardMaterial color="#16375f" metalness={0.45} roughness={0.16} />
      </mesh>
      <mesh position={[1.78, 0.98, 0.556]}>
        <boxGeometry args={[0.02, 0.16, 0.02]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.3} />
      </mesh>

      {[-1.2, -0.15, 0.9].map((x) => (
        <mesh key={`bay-${x}`} position={[x, 0.52, 0.548]}>
          <planeGeometry args={[0.86, 0.2]} />
          <meshStandardMaterial color="#e7eef6" roughness={0.55} />
        </mesh>
      ))}

      <mesh position={[-0.15, 0.94, 0.556]}>
        <planeGeometry args={[1.35, 0.26]} />
        <meshBasicMaterial map={logo} transparent toneMapped={false} />
      </mesh>

      <mesh position={[2.3, 1.22, 0]}>
        <boxGeometry args={[0.03, 0.28, 0.7]} />
        <meshStandardMaterial color={GLASS} metalness={0.5} roughness={0.1} />
      </mesh>
      <mesh position={[2.31, 1.42, 0]}>
        <boxGeometry args={[0.025, 0.08, 0.48]} />
        <meshBasicMaterial color="#0b1220" />
      </mesh>

      {[-0.32, 0.32].map((z) => (
        <mesh key={`lamp-${z}`} position={[2.3, 0.58, z]}>
          <sphereGeometry args={[0.065, 16, 16]} />
          <meshStandardMaterial color="#fff6d0" emissive="#ffe7a3" emissiveIntensity={1.6} />
        </mesh>
      ))}
      {[-0.46, 0.46].map((z) => (
        <mesh key={`ind-${z}`} position={[2.28, 0.58, z]}>
          <boxGeometry args={[0.04, 0.06, 0.08]} />
          <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.6} />
        </mesh>
      ))}

      <mesh position={[2.18, 0.42, 0]}>
        <boxGeometry args={[0.16, 0.12, 0.92]} />
        <meshStandardMaterial color="#d5dee8" roughness={0.45} />
      </mesh>

      <mesh position={[-2.29, 1.24, 0]}>
        <boxGeometry args={[0.03, 0.22, 0.62]} />
        <meshStandardMaterial color="#0c1c33" metalness={0.4} roughness={0.2} />
      </mesh>
      {[-0.28, 0.28].map((z) => (
        <mesh key={`tail-${z}`} position={[-2.3, 0.58, z]}>
          <boxGeometry args={[0.04, 0.08, 0.16]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.7} />
        </mesh>
      ))}

      {[
        [1.9, 1.18, 0.58],
        [1.9, 1.18, -0.58],
      ].map((position) => (
        <mesh key={position.join()} position={position as [number, number, number]}>
          <boxGeometry args={[0.1, 0.06, 0.1]} />
          <meshStandardMaterial color="#1f2937" metalness={0.4} roughness={0.35} />
        </mesh>
      ))}

      <RoundedBox args={[0.72, 0.1, 0.5]} radius={0.04} position={[-0.35, 1.66, 0]}>
        <meshStandardMaterial color="#e8eef5" roughness={0.4} />
      </RoundedBox>
      {[-0.32, 0.32].map((z) => (
        <mesh key={`rail-${z}`} position={[0.1, 1.64, z]}>
          <boxGeometry args={[2.6, 0.025, 0.03]} />
          <meshStandardMaterial color="#c5d0dc" metalness={0.7} roughness={0.28} />
        </mesh>
      ))}

      <Wheel x={1.42} z={0.5} />
      <Wheel x={1.42} z={-0.5} />
      <Wheel x={-1.38} z={0.5} dual />
      <Wheel x={-1.38} z={-0.5} dual />
    </group>
  );
}

function drawQr(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const n = 21;
  const cell = size / n;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 10, y - 10, size + 20, size + 20);
  ctx.fillStyle = "#0f172a";
  const finder = (fx: number, fy: number) => {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(x + fx * cell, y + fy * cell, cell * 7, cell * 7);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + (fx + 1) * cell, y + (fy + 1) * cell, cell * 5, cell * 5);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(x + (fx + 2) * cell, y + (fy + 2) * cell, cell * 3, cell * 3);
  };
  finder(0, 0);
  finder(14, 0);
  finder(0, 14);
  let seed = 17;
  ctx.fillStyle = "#0f172a";
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      const inFinder = (row < 7 && col < 7) || (row < 7 && col > 13) || (row > 13 && col < 7);
      if (inFinder) continue;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (seed % 3 !== 0) ctx.fillRect(x + col * cell, y + row * cell, Math.ceil(cell) - 0.5, Math.ceil(cell) - 0.5);
    }
  }
}

function BoardingPass({
  texture,
  reduced,
}: {
  texture: THREE.Texture;
  reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const [hot, setHot] = useState(false);

  useFrame((state, delta) => {
    const node = group.current;
    if (!node) return;
    const bob = reduced ? 0.72 : 0.72 + Math.sin(state.clock.elapsedTime * 1.15) * 0.03;
    const lift = hot ? bob + 0.06 : bob;
    const scale = hot ? 0.9 : 0.82;
    node.position.y = THREE.MathUtils.damp(node.position.y, lift, 4, delta);
    node.scale.x = THREE.MathUtils.damp(node.scale.x, scale, 5, delta);
    node.scale.y = THREE.MathUtils.damp(node.scale.y, scale, 5, delta);
    node.scale.z = THREE.MathUtils.damp(node.scale.z, scale, 5, delta);
  });

  return (
    <Billboard ref={group} position={[0.55, 0.78, 1.25]} follow
      onPointerOver={(event) => {
        event.stopPropagation();
        setHot(true);
        const canvas = event.nativeEvent.target;
        if (canvas instanceof HTMLElement) canvas.style.cursor = "pointer";
      }}
      onPointerOut={(event) => {
        setHot(false);
        const canvas = event.nativeEvent.target;
        if (canvas instanceof HTMLElement) canvas.style.cursor = "grab";
      }}
    >
      <RoundedBox args={[0.78, 1.24, 0.02]} radius={0.045} position={[0, 0, -0.012]}>
        <meshStandardMaterial color={STRIPE} roughness={0.4} />
      </RoundedBox>
      <RoundedBox args={[0.74, 1.2, 0.04]} radius={0.04} smoothness={3}>
        <meshStandardMaterial color="#f8fafc" roughness={0.42} />
      </RoundedBox>
      <mesh position={[0, 0, 0.024]}>
        <planeGeometry args={[0.68, 1.12]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

function Scene({ reduced }: { reduced: boolean }) {
  const logo = useMemo(
    () =>
      makeTexture((ctx) => {
        ctx.clearRect(0, 0, 512, 128);
        ctx.fillStyle = STRIPE;
        ctx.font = "700 68px sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText("Asol BUS", 8, 66);
      }, 512, 128),
    []
  );

  const pass = useMemo(
    () =>
      makeTexture((ctx, w, h) => {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = STRIPE;
      ctx.fillRect(0, 0, w, 210);
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 64px sans-serif";
      ctx.fillText("Asol BUS", 48, 118);
      ctx.font = "500 26px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.fillText("BOARDING PASS", 48, 168);

      ctx.fillStyle = "#64748b";
      ctx.font = "600 22px sans-serif";
      ctx.fillText("FROM", 48, 280);
      ctx.fillText("TO", 360, 280);
      ctx.fillStyle = "#0f172a";
      ctx.font = "700 52px sans-serif";
      ctx.fillText("Kyiv", 48, 348);
      ctx.fillText("Berlin", 360, 348);
      ctx.fillStyle = STRIPE;
      ctx.font = "700 40px sans-serif";
      ctx.fillText("→", 268, 344);

      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(48, 410);
      ctx.lineTo(w - 48, 410);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#64748b";
      ctx.font = "600 20px sans-serif";
      ctx.fillText("DATE", 48, 470);
      ctx.fillText("SEAT", 320, 470);
      ctx.fillStyle = "#0f172a";
      ctx.font = "700 36px sans-serif";
      ctx.fillText("22 Sep", 48, 522);
      ctx.fillText("14", 320, 522);

      ctx.fillStyle = "#64748b";
      ctx.font = "600 20px sans-serif";
      ctx.fillText("TICKET", 48, 610);
      ctx.fillStyle = "#0f172a";
      ctx.font = "700 44px sans-serif";
      ctx.fillText("AB-10001", 48, 668);

      drawQr(ctx, w - 250, h - 280, 180);
    }, 640, 1040),
    []
  );

  useEffect(() => {
    return () => {
      logo.dispose();
      pass.dispose();
    };
  }, [logo, pass]);

  return (
    <>
      <hemisphereLight color="#f7fbff" groundColor="#123a86" intensity={0.7} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 8, 4]} intensity={2.4} color="#ffffff" />
      <directionalLight position={[-4, 3, -2]} intensity={0.7} color="#c5dcff" />
      <directionalLight position={[1, 2, 6]} intensity={0.45} color="#fff4e5" />

      <PresentationControls
        global
        snap
        rotation={[0.08, -0.5, 0]}
        polar={[-0.16, 0.2]}
        azimuth={[-0.4, 0.7]}
        speed={1.15}
        damping={0.28}
      >
        <Coach logo={logo} />
        <BoardingPass texture={pass} reduced={reduced} />
      </PresentationControls>

      <ContactShadows position={[0, 0, 0]} opacity={0.38} scale={9} blur={2.4} far={4} color="#061433" />
    </>
  );
}

export default function HeroScene() {
  const [support] = useState<"ok" | "no">(() => (hasWebGL() ? "ok" : "no"));
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  if (support !== "ok") return <HeroFallback />;

  return (
    <Canvas
      className="h-full w-full"
      dpr={[1, 1.6]}
      camera={{ position: [3.35, 1.28, 4.05], fov: 30, near: 0.1, far: 50 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl, camera }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        camera.lookAt(0.05, 0.78, 0);
      }}
    >
      <Scene reduced={reduced} />
    </Canvas>
  );
}
