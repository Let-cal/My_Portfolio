"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePrefersReducedMotion, useMediaQuery } from "@/components/fx/use-media-query";
import { useRole } from "@/components/site/RoleProvider";
import { useTheme } from "@/components/site/theme";
import { DRAGON_CHAPTER } from "./chapters";
import { shouldLoadScene } from "./loading";
import { SceneErrorBoundary } from "./SceneErrorBoundary";
import { sceneStore, useSceneStore } from "./store";
import { TextVeil } from "./TextVeil";
import { detectTier, detectWebGL, MOBILE_QUERY, type Tier } from "./tier";
import { useLoadGate } from "./use-load-gate";
import { useAvoidTracking, useChapterTracking, useCtaTracking, useFeedClicks, usePointerTracking } from "./use-scene-input";

// three and @react-three/fiber live behind this import: the chunk is fetched only once the scene may load.
const SceneRoot = dynamic(() => import("./SceneRoot"), { ssr: false });

const noSubscription = () => () => {};
const FADE_MS = 700;

/** Client-only facts, read without an effect: null / 4 on the server so hydration matches. */
function useBrowserFacts() {
  const body = useSyncExternalStore(noSubscription, () => document.body, () => null);
  const webgl = useSyncExternalStore<boolean | null>(noSubscription, detectWebGL, () => null);
  const cores = useSyncExternalStore(noSubscription, () => navigator.hardwareConcurrency || 4, () => 4);
  return { body, webgl, cores };
}

/**
 * The page-wide backdrop: a fixed layer behind the content (z-index -1, under the pointer spotlight and
 * the page). It shows a static koi (a dragon from "Why me" on) and, when the device tier allows, loads the
 * 3D scene lazily on top and fades the image out. Mount it on the home page only.
 *
 * Tier, load timing and the motion toggle are evaluated live: switching Motion off unmounts the canvas and
 * brings the image back; switching it on loads the scene again.
 */
export function KoiCanvas() {
  const { body, webgl, cores } = useBrowserFacts();
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { theme } = useTheme();
  const { role } = useRole();
  const gate = useLoadGate();
  const [downgraded, setDowngraded] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const dragon = useSceneStore((s) => s.chapter >= DRAGON_CHAPTER);

  // Until WebGL has been probed the tier is `off`, so nothing loads and the image shows.
  const detected: Tier = webgl === null || failed ? "off" : detectTier({ webgl, reducedMotion, isMobile, cores });
  const tier: Tier = detected === "high" && downgraded ? "low" : detected;
  const load = shouldLoadScene({ tier, isMobile, ...gate });

  useChapterTracking();
  usePointerTracking(tier !== "off");
  useAvoidTracking(tier !== "off");
  useCtaTracking(tier !== "off");
  useFeedClicks(tier !== "off");
  useEffect(() => {
    sceneStore.setState({ tier, theme, role });
  }, [tier, theme, role]);

  if (!body) return null;

  const src = `/fallback/${dragon ? "dragon" : "koi"}-${theme === "light" ? "day" : "night"}.jpg`;
  const onSceneError = (error: unknown) => {
    // Once is enough: `failed` keeps the tier off, so the scene is not mounted (and cannot throw) again.
    console.warn("3D scene failed to start; showing the static image instead.", error);
    setFailed(true);
  };
  const sceneVisible = load && ready && tier !== "off";
  return createPortal(
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-bleed backdrop; next/image would add an optimiser round-trip for no gain */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        decoding="async"
        data-koi-fallback=""
        className="print:hidden"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: -1,
          pointerEvents: "none",
          opacity: sceneVisible ? 0 : 0.6,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      />
      {load && tier !== "off" && (
        <div
          data-koi-canvas=""
          aria-hidden="true"
          className="print:hidden"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: -1,
            pointerEvents: "none",
            opacity: sceneVisible ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease`,
          }}
        >
          <SceneErrorBoundary onError={onSceneError}>
            <SceneRoot tier={tier} onReadyChange={setReady} onDowngrade={() => setDowngraded(true)} />
          </SceneErrorBoundary>
          <TextVeil />
        </div>
      )}
    </>,
    body,
  );
}
