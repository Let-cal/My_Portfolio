"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { MIN_FPS_SAMPLES, shouldDowngrade, type Tier } from "./tier";

/** The first frames include shader compilation and context setup; they say nothing about steady-state speed. */
const WARMUP_FRAMES = 8;
/** A frame this long means the tab was hidden or the main thread was blocked, not that the scene is slow. */
const MAX_SAMPLE_DELTA = 0.25;

/**
 * Measures the frame rate over the first 60 usable frames (about a second at 60 fps, two at 30) and asks for
 * the `low` tier when the average is under 40 fps. Does nothing once it has decided or when already `low`.
 */
function FpsProbe({ onDowngrade }: { onDowngrade: () => void }) {
  const samples = useRef<number[]>([]);
  const frames = useRef(0);
  const done = useRef(false);
  useFrame((_, delta) => {
    if (done.current) return;
    if (frames.current++ < WARMUP_FRAMES || delta <= 0 || delta > MAX_SAMPLE_DELTA) return;
    samples.current.push(1 / delta);
    if (samples.current.length < MIN_FPS_SAMPLES) return;
    done.current = true;
    if (shouldDowngrade(samples.current)) onDowngrade();
  });
  return null;
}

type SceneRootProps = {
  tier: Exclude<Tier, "off">;
  /** The canvas exists (true) or has been removed (false); the static image fades out while it is true. */
  onReadyChange: (ready: boolean) => void;
  onDowngrade: () => void;
};

/**
 * The 3D layer. For now an empty transparent canvas; the creature, water and lights are added on top.
 * Rendering stops while the tab is hidden. The canvas is `position: fixed`, so it is never off-screen.
 */
export default function SceneRoot({ tier, onReadyChange, onDowngrade }: SceneRootProps) {
  const [hidden, setHidden] = useState(() => document.hidden);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => () => onReadyChange(false), [onReadyChange]);

  return (
    <Canvas
      dpr={[1, tier === "high" ? 1.5 : 1.25]}
      frameloop={hidden ? "never" : "always"}
      gl={{ alpha: true, antialias: tier === "high", powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        onReadyChange(true);
      }}
    >
      {tier === "high" && <FpsProbe onDowngrade={onDowngrade} />}
    </Canvas>
  );
}
