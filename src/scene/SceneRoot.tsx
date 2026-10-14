"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Creature } from "./creature/Creature";
import { Lighting } from "./environment/Lighting";
import { Props } from "./environment/Props";
import { Stage } from "./environment/Stage";
import { Water } from "./environment/Water";
import { Feeding } from "./interactions/Feeding";
import { MIN_FPS_SAMPLES, shouldDowngrade, type Tier } from "./tier";

// Bloom lives in its own chunk: only the `high` tier ever downloads the post-processing code.
const PostFX = lazy(() => import("./environment/PostFX"));

/** The first frames include shader compilation and context setup; they say nothing about steady-state speed. */
const WARMUP_FRAMES = 8;
/** Longest frame time a sample may report (seconds). */
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
    if (frames.current++ < WARMUP_FRAMES || delta <= 0) return;
    // A long frame (hidden tab, blocked thread) counts as a slow one, but no slower than 4 fps.
    samples.current.push(1 / Math.min(delta, MAX_SAMPLE_DELTA));
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
 * The 3D layer, an opaque canvas that is the page's backdrop: the night/day pond (water, per-chapter scenery,
 * lighting and camera), the koi/dragon, fish food and, on the `high` tier, bloom. (The veil that keeps text readable is a DOM layer, see `TextVeil`.)
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
      // R3F's wrapper div defaults to pointer-events: auto when there is no eventSource, which would catch every
      // click over the viewport. The scene reads the pointer from the store instead, so nothing here needs events.
      style={{ pointerEvents: "none" }}
      dpr={[1, tier === "high" ? 1.5 : 1.25]}
      frameloop={hidden ? "never" : "always"}
      // Opaque: the pond is the background, and bloom needs a canvas without alpha. Always antialiased: a downgrade
      // from high to low unmounts the post-processing, which then relies on the context's own multisampling.
      gl={{ alpha: false, antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 40, near: 0.1, far: 80, position: [0, 3.8, 4.2] }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.05;
        onReadyChange(true);
      }}
    >
      {tier === "high" && <FpsProbe onDowngrade={onDowngrade} />}
      <Stage />
      <Lighting />
      <Water />
      <Props />
      <Creature />
      <Feeding />
      {tier === "high" && (
        <Suspense fallback={null}>
          <PostFX />
        </Suspense>
      )}
    </Canvas>
  );
}
