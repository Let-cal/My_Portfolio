# Shared pond and waterfall garden — approved option A

## Owner decision

Approved on 2026-10-15: a Japanese stream garden that changes from dawn to moonlit night. Projects and Skills share the same 3D pond, lotus instances and scenery. Follow-up choice: retain the cyber grid as a faint submerged pattern in those two chapters at night, preserving the existing grid elsewhere. Photographs guide composition only; no landscape image plate, video or 2.5D replacement is permitted.

## Implementation

- A shared garden weight establishes the scenery during Projects and fades it before the existing lantern chapter. During this interval the night grid becomes a desaturated underwater pattern with approximate depth/parallax and stronger ripple distortion. Fresnel reflection and the landing-basin mask attenuate its visibility; other chapters retain their original cyber water. These controls are artistic approximations, not simulated refraction through a volumetric pond.
- Lotus positions and sizes do not depend on chapter weight. The same ten leaves and three flowers remain through Skills; only the eventual departure fades their materials.
- The Projects–Skills and Skills–Certificates camera segments use bounded curved paths derived from scroll position. Both endpoints remain exact, and reverse scrolling follows the same path. Camera height stays above the pond.
- The waterfall is a smaller garden cascade with two physical terraces. The closed cliff has lower, irregular shoulders and follows the water's terrace depth. Existing CC0 rocks and PBR maps remain locally hosted and deferred.
- Asymmetric shore stones, small moss clumps and individual leaves frame the pond. Three instanced stone tōrō lamps use open four-post housings and warm emissive interiors at night.
- A procedural 3D sky dome and a sphere at a shared celestial position provide the dawn sun/night moon. Theme changes blend uniforms, material colors and the existing lights; models are not rebuilt or duplicated.
- The water approximates celestial and lamp reflections analytically. This is not a full mirror of every tree/rock and does not use a second render pass.
- Content cards and bounded reading backdrops remain. The scene presence value includes the shared garden so reading protection does not dip in the transition. Skills group surfaces now belong to their own document elements, so native scrolling moves content and background together; the fixed scene veil does not create a second panel for those groups, the terminal or the opaque evidence panel.

## Cost controls

No additional external assets, account or paid service. Seven extra mesh batches for the banks, lamps and sky; zero new light objects, shadow maps or reflection targets. Shore moss uses lower-detail geometry. Repeated models are instanced, resources are owned by the existing prop disposer, and scene updates do not allocate React state each frame. The startup bundle remains separate from the deferred scene.

## Verification

New regression cases were observed failing for lotus fade, straight camera path and absent garden lanterns, then passing after implementation. Coverage includes exact chapter endpoints, reversible path sampling, stable lotus matrices in both themes, lamp emission and absence of per-lamp lights. Production build, full unit/browser suites, shader compilation, deferred assets, screenshots, scroll stability and initial-JS budget must be measured after the final edits.

Independent scene review found a transparent sky dome drawing over opaque water and rock displacement protruding into the cascade. Both were reproduced with failing tests and fixed: depth-tested sky; shared terrace profile evaluated at world height, leaving clearance beyond the maximum grain displacement.

Skills wheel-scroll reproduction on the owner's dev server: 220 sampled frames, fixed-overlay displacement reached 115.703125px; 27 frames exceeded 8px. After local group surfaces: the same 220-frame wheel sequence measured zero relative drift. Earlier step-scroll/panel-reassignment checks did not catch this asynchronous-scroll defect. Dedicated browser cases now cover both themes under the pointer.

The broader Lighthouse and mobile performance release gates remain open until fresh measurements meet the approved budgets. This scene checkpoint is not authorization to mark all FE work complete or skip CI/review before release.

Final scene checkpoint: production build and lint pass, 778 unit cases, 46 production-browser cases and 17 artifact checks pass. Initial home JavaScript is199.9KB gzip; quick view176.2KB. Browser snapshots show no shader/page errors. On this desktop's D3D11 GPU at1440×900 with the low-tier4-core profile, 90 steady-state frames per theme measured59.9–60.0rendered frames/s,31draw calls and161,240triangles/frame. This is a desktop render-cadence observation, not proof of performance on a physical mobile GPU.

### Deferred construction follow-up

The waterfall module and geometry now load on approach, starting during Experience before the shared garden becomes visible. The same models, materials, camera and animations are retained; startup does not build hidden garden geometry. The module's construction code is verified to occupy a separate production chunk from the 3D entry. A failed chunk leaves the pond and portfolio usable, without per-frame retries.

Scenery ownership now belongs to effect setup/cleanup. A Strict Mode regression was reproduced (the disposed lazy wrapper never loaded on the owner's dev server), then corrected: setup creates fresh props, cleanup detaches and disposes precisely those instances, and late promises cannot create geometry after unmount. The dev-server model-request probe changed from0to1. This follows React's effect replay lifecycle without disabling Strict Mode.

Final follow-up verification:782unit tests,18artifact checks,15focused production motion/veil browser cases,lint and production build pass. The full46-case browser suite also passed before the final Strict Mode ownership adjustment; the15focused cases were rerun afterward. Home initial JS remains199.9KB gzip,quick176.3KB. Independent read-only review found no concrete remaining lifecycle flaw.

Lighthouse mobile median across3runs on/en before this desktop-only deferral:Performance68,Accessibility100,BestPractices100,localSEO92,FCP2267ms,LCP5152ms,TBT382ms,CLS0. Performance gates remain unmet. Mobile already uses a static scene, so desktop garden deferral is not claimed to fix mobile Lighthouse. Raw runs remain in the ignored task18a workspace.

The palette follow-up was approved on 2026-10-15: option A (obsidian, moon silver and amber) aligns the garden's dark sky/water/fog with the surrounding black cyber scenes. Models and layout remain accepted. The browser-only studies are disposable; the production implementation and its verification are documented in [garden night palette](garden-night-palette.md).

## References

- Japanese garden day/night composition: https://www.japan.travel/en/japans-local-treasures/yuushien-garden-illuminations/
- Instancing and quality scaling: https://r3f.docs.pmnd.rs/advanced/scaling-performance
- Reflection tradeoffs: https://threejs.org/docs/pages/Water.html
- Existing asset provenance: [waterfall environment review](waterfall-environment-review.md)
