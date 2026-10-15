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
import { detectTier, detectWebGL, MOBILE_QUERY, type Tier } from "./tier";
import { useLoadGate } from "./use-load-gate";
import { useStaticChapterTracking } from "./use-static-chapter";

// three and @react-three/fiber live behind this import: the chunk is fetched only once the scene may load.
const SceneRoot = dynamic(() => import("./SceneRoot"), { ssr: false });
const LiveSceneInput = dynamic(() => import("./LiveSceneInput"), { ssr: false });

const noSubscription = () => () => {};
const FADE_MS = 700;

/** Client-only facts, read without an effect: null / 4 on the server so hydration matches. */
function useBrowserFacts(skipWebGL: boolean) {
  const body = useSyncExternalStore(noSubscription, () => document.body, () => null);
  const webgl = useSyncExternalStore<boolean | null>(noSubscription, () => {
    const mobileNow = typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches;
    return skipWebGL || mobileNow ? false : detectWebGL();
  }, () => null);
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
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { body, webgl, cores } = useBrowserFacts(isMobile);
  const reducedMotion = usePrefersReducedMotion();
  const { theme } = useTheme();
  const { role } = useRole();
  const gate = useLoadGate();
  const [capture, setCapture] = useState<null | { creature: "koi" | "dragon"; theme: "light" | "dark" }>(null);
  const [captureConfigured, setCaptureConfigured] = useState(false);
  const [captureSettled, setCaptureSettled] = useState(false);
  const [downgraded, setDowngraded] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const storedDragon = useSceneStore((s) => s.chapter >= DRAGON_CHAPTER);
  const dragon = capture ? capture.creature === "dragon" : storedDragon;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const creature = params.get("capture");
    if (creature !== "koi" && creature !== "dragon") return;
    const capturedTheme = params.get("theme") === "day" ? "light" : "dark";
    document.documentElement.setAttribute("data-scene-capture", "");
    const frame = requestAnimationFrame(() => setCapture({ creature, theme: capturedTheme }));
    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.removeAttribute("data-scene-capture");
    };
  }, []);

  // Until WebGL has been probed the tier is `off`, so nothing loads and the image shows.
  const detected: Tier = webgl !== true || failed ? "off" : capture ? "high" : detectTier({ webgl, reducedMotion, isMobile, cores });
  const tier: Tier = detected === "high" && downgraded ? "low" : detected;
  const load = capture ? captureConfigured : shouldLoadScene({ tier, isMobile, ...gate });

  useStaticChapterTracking(capture === null && (!load || tier === "off"));
  useEffect(() => {
    sceneStore.setState({ tier, theme: capture?.theme ?? theme, role, ...(capture ? { chapter: capture.creature === "dragon" ? 6 : 0, t: 0, pointer: null } : {}) });
    if (!capture) return;
    const frame = requestAnimationFrame(() => setCaptureConfigured(true));
    return () => cancelAnimationFrame(frame);
  }, [tier, theme, role, capture]);
  useEffect(() => {
    if (!capture || !ready) return;
    const timer = window.setTimeout(() => {
      setCaptureSettled(true);
      (window as Window & { __sceneCaptureReady?: boolean }).__sceneCaptureReady = true;
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [capture, ready]);

  if (!body) return null;

  const activeTheme = capture?.theme ?? theme;
  const src = `/fallback/${dragon ? "dragon" : "koi"}-${activeTheme === "light" ? "day" : "night"}.jpg`;
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
          // The static route has no tracked text veil; keep even the brightest fallback pixels subdued.
          opacity: sceneVisible ? 0 : activeTheme === "light" ? 0.3 : 0.15,
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
            zIndex: capture ? 0 : -1,
            pointerEvents: "none",
            opacity: sceneVisible ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease`,
          }}
        >
          <SceneErrorBoundary onError={onSceneError}>
            <LiveSceneInput enabled={capture === null} />
            <SceneRoot
              tier={tier}
              onReadyChange={setReady}
              onDowngrade={() => setDowngraded(true)}
              capture={capture !== null}
              captureSettled={captureSettled}
            />
          </SceneErrorBoundary>
        </div>
      )}
    </>,
    body,
  );
}
