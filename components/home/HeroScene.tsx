"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, ContactShadows, PresentationControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import HeroFallback from "@/components/home/HeroFallback";

const PAINT = "#101114";
const GOLD = "#f0c21a";
const GLASS = "#31465f";
const STRIPE = "#195ef0";

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

function Coach({ livery, frontMark }: { livery: THREE.Texture; frontMark: THREE.Texture }) {
  const lowerXs = [-1.85, -1.38, -0.91, -0.44, 0.03, 0.5, 0.97];
  const upperXs = [-1.95, -1.5, -1.05, -0.6, -0.15, 0.3, 0.75, 1.2];
  return (
    <group position={[-0.2, 0, 0]} scale={0.78}>
      <RoundedBox args={[5.05, 1.92, 1.06]} radius={0.16} smoothness={4} position={[0, 1.22, 0]}>
        <meshPhysicalMaterial color={PAINT} roughness={0.22} metalness={0.62} clearcoat={1} clearcoatRoughness={0.12} />
      </RoundedBox>

      {lowerXs.map((x) => (
        <mesh key={`low+${x}`} position={[x, 1.02, 0.56]}>
          <boxGeometry args={[0.36, 0.3, 0.05]} />
          <meshStandardMaterial color={GLASS} metalness={0.8} roughness={0.08} />
        </mesh>
      ))}
      {lowerXs.map((x) => (
        <mesh key={`low-${x}`} position={[x, 1.02, -0.56]}>
          <boxGeometry args={[0.36, 0.3, 0.05]} />
          <meshStandardMaterial color={GLASS} metalness={0.8} roughness={0.08} />
        </mesh>
      ))}
      {upperXs.map((x) => (
        <mesh key={`up+${x}`} position={[x, 1.7, 0.56]}>
          <boxGeometry args={[0.36, 0.36, 0.05]} />
          <meshStandardMaterial color={GLASS} metalness={0.8} roughness={0.08} />
        </mesh>
      ))}
      {upperXs.map((x) => (
        <mesh key={`up-${x}`} position={[x, 1.7, -0.56]}>
          <boxGeometry args={[0.36, 0.36, 0.05]} />
          <meshStandardMaterial color={GLASS} metalness={0.8} roughness={0.08} />
        </mesh>
      ))}

      <mesh position={[1.55, 1.02, 0.542]}>
        <planeGeometry args={[0.42, 0.72]} />
        <meshStandardMaterial color="#101820" metalness={0.55} roughness={0.12} />
      </mesh>

      {([0.535, -0.535] as const).map((z) => (
        <mesh key={`liv-${z}`} position={[0.05, 0.95, z]} rotation={[0, z > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[3.2, 0.95]} />
          <meshBasicMaterial map={livery} transparent toneMapped={false} depthWrite={false} />
        </mesh>
      ))}

      <mesh position={[2.58, 1.78, 0]}>
        <boxGeometry args={[0.05, 0.38, 0.82]} />
        <meshStandardMaterial color={GLASS} metalness={0.8} roughness={0.08} />
      </mesh>
      <mesh position={[2.58, 1.16, 0]}>
        <boxGeometry args={[0.05, 0.36, 0.88]} />
        <meshStandardMaterial color={GLASS} metalness={0.8} roughness={0.08} />
      </mesh>
      <mesh position={[2.57, 1.46, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.86, 0.18]} />
        <meshBasicMaterial map={frontMark} transparent toneMapped={false} />
      </mesh>

      {[-0.28, 0.28].map((z) => (
        <mesh key={`lamp-${z}`} position={[2.55, 0.58, z]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color="#fff4cc" emissive="#ffe7a3" emissiveIntensity={1.4} />
        </mesh>
      ))}
      {[-0.42, 0.42].map((z) => (
        <mesh key={`ind-${z}`} position={[2.54, 0.58, z]}>
          <boxGeometry args={[0.03, 0.05, 0.07]} />
          <meshStandardMaterial color="#fb923c" emissive="#fb923c" emissiveIntensity={0.5} />
        </mesh>
      ))}

      <mesh position={[-2.54, 1.55, 0]}>
        <boxGeometry args={[0.03, 0.55, 0.72]} />
        <meshStandardMaterial color="#0c121c" metalness={0.45} roughness={0.18} />
      </mesh>
      {[-0.22, 0.22].map((z) => (
        <mesh key={`tail-${z}`} position={[-2.55, 0.62, z]}>
          <boxGeometry args={[0.03, 0.07, 0.14]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.55} />
        </mesh>
      ))}

      {[
        [2.15, 1.35, 0.58],
        [2.15, 1.35, -0.58],
      ].map((position) => (
        <mesh key={position.join()} position={position as [number, number, number]}>
          <boxGeometry args={[0.08, 0.05, 0.08]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.4} roughness={0.4} />
        </mesh>
      ))}

      <Wheel x={1.7} z={0.48} />
      <Wheel x={1.7} z={-0.48} />
      <Wheel x={-0.95} z={0.48} />
      <Wheel x={-0.95} z={-0.48} />
      <Wheel x={-1.72} z={0.48} dual />
      <Wheel x={-1.72} z={-0.48} dual />
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
    const bob = reduced ? 0.5 : 0.5 + Math.sin(state.clock.elapsedTime * 1.15) * 0.03;
    const lift = hot ? bob + 0.06 : bob;
    const scale = hot ? 0.78 : 0.7;
    node.position.y = THREE.MathUtils.damp(node.position.y, lift, 4, delta);
    node.scale.x = THREE.MathUtils.damp(node.scale.x, scale, 5, delta);
    node.scale.y = THREE.MathUtils.damp(node.scale.y, scale, 5, delta);
    node.scale.z = THREE.MathUtils.damp(node.scale.z, scale, 5, delta);
  });

  return (
    <Billboard ref={group} position={[-0.15, 0.5, 1.9]} follow
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
  const livery = useMemo(
    () =>
      makeTexture((ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = GOLD;
        ctx.lineCap = "round";
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(30, h - 78);
        ctx.bezierCurveTo(220, h - 36, 620, h - 110, w - 30, h - 150);
        ctx.stroke();
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(70, h - 112);
        ctx.bezierCurveTo(260, h - 70, 680, h - 146, w - 70, h - 188);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "600 28px sans-serif";
        ctx.fillText("Подорожуй з країни в Німеччину та Іспанію", 48, 46);

        ctx.fillStyle = GOLD;
        ctx.font = "800 64px sans-serif";
        ctx.fillText("GRANDES TOUR", 48, 118);

        ctx.font = "italic 700 26px sans-serif";
        ctx.fillText("Royal Class", w - 300, 78);
        ctx.font = "700 22px sans-serif";
        ctx.fillText("★★★★", w - 250, 112);
      }, 1400, 460),
    []
  );

  const frontMark = useMemo(
    () =>
      makeTexture((ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 64px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("GRANDES TOUR", w / 2, h / 2);
      }, 640, 128),
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
      livery.dispose();
      frontMark.dispose();
      pass.dispose();
    };
  }, [livery, frontMark, pass]);

  return (
    <>
      <hemisphereLight color="#f7fbff" groundColor="#123a86" intensity={0.7} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 7, 5]} intensity={3.1} color="#ffffff" />
      <directionalLight position={[-5, 4, 2]} intensity={1.15} color="#dbe7ff" />
      <directionalLight position={[1, 3, 6]} intensity={0.8} color="#fff6df" />

      <PresentationControls
        global
        snap
        rotation={[0.18, -0.2, 0]}
        polar={[-0.16, 0.2]}
        azimuth={[-0.4, 0.7]}
        speed={1.15}
        damping={0.28}
      >
        <Coach livery={livery} frontMark={frontMark} />
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
      camera={{ position: [2.15, 1.45, 5.6], fov: 28, near: 0.1, far: 50 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl, camera }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.16;
        camera.lookAt(0.1, 0.9, 0);
      }}
    >
      <Scene reduced={reduced} />
    </Canvas>
  );
}
