# ADR-0003: The 3D scene never blocks content

- Status: Accepted
- Date: 2026-10-14
- Introduced in: [PR #1](https://github.com/Let-cal/My_Portfolio/pull/1)

## Context

The koi-to-dragon garden is a WebGL scene (Three.js, React Three Fiber). It is the most expensive part of the page. The content (experience, projects, skills, CVs) is what recruiters need, and it must be readable on phones, slow machines, with reduced motion and without WebGL. The initial JavaScript budget is 200 KB gzip before the 3D chunks.

## Decision

- The page content is server-rendered and does not depend on the scene. The scene is a backdrop layer.
- `detectTier()` in `src/scene/tier.ts` picks one of three tiers:
  - `off` (static image, no canvas): mobile, reduced motion or no WebGL;
  - `low` (fewer points, no bloom, no reflections): desktops with 4 or fewer cores;
  - `high`: other desktops.
- `shouldLoadScene()` in `src/scene/loading.ts` never loads the 3D chunk for `off`. On desktop it waits for the load gate: the `load` event plus a browser idle callback (`src/scene/use-load-gate.ts`).
- The scene is a dynamic import with `ssr: false`; bloom is a separate chunk that only `high` downloads.
- A frame-rate probe drops to `low` when 60 samples average under 40 fps.
- A `SceneErrorBoundary` replaces a failed scene with the static image.
- Rendering stops while the tab is hidden.

## Consequences

Positive:

- Mobile visitors and the Lighthouse mobile runs never download three.js.
- A WebGL failure costs the backdrop, not the page.
- The 200 KB initial-JavaScript gate measures the content page, not the scene.

Negative / trade-offs:

- Two visual paths (live and static) must both look right. Committed fallback images and browser tests cover the static path.
- Desktop visitors see the static image first and the live scene a moment later.
- Device tiering is a heuristic (cores, media query, WebGL probe), not a benchmark.

## Evidence

- Code: [src/scene/tier.ts](../../src/scene/tier.ts), [src/scene/loading.ts](../../src/scene/loading.ts), [src/scene/use-load-gate.ts](../../src/scene/use-load-gate.ts), [src/scene/KoiCanvas.tsx](../../src/scene/KoiCanvas.tsx), [src/scene/SceneRoot.tsx](../../src/scene/SceneRoot.tsx), [src/scene/SceneErrorBoundary.tsx](../../src/scene/SceneErrorBoundary.tsx)
- Tests: [tests/unit/scene-logic.test.ts](../../tests/unit/scene-logic.test.ts) (tiers, downgrade, load timing), [tests/unit/koi-canvas.test.tsx](../../tests/unit/koi-canvas.test.tsx), [tests/unit/scene-root.test.tsx](../../tests/unit/scene-root.test.tsx)
- Budget: [scripts/measure-initial-js.mjs](../../scripts/measure-initial-js.mjs) and the Checks section of [docs/ci-release.md](../ci-release.md)
