"use client";

import { Component, useEffect, useState, type ComponentType, type ReactNode } from "react";
import HeroFallback from "@/components/home/HeroFallback";

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <HeroFallback />;
    return this.props.children;
  }
}

/**
 * Loads the WebGL scene only in the browser. next/dynamic with ssr:false
 * bails out of this client tree and never paints the canvas.
 */
export default function HeroStage() {
  const [Scene, setScene] = useState<ComponentType | null>(null);

  useEffect(() => {
    let alive = true;
    import("@/components/home/HeroScene")
      .then((mod) => {
        if (alive) setScene(() => mod.default);
      })
      .catch(() => {
        if (alive) setScene(() => HeroFallback);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <SceneBoundary>{Scene ? <Scene /> : <div className="h-full w-full" />}</SceneBoundary>
      </div>
      <p className="pb-1 text-center text-[11px] font-medium tracking-wide text-white/75">
        Drag to look around
      </p>
    </div>
  );
}
