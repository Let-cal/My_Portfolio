# Content surfaces over the koi scene

## Decision

Keep visible content surfaces throughout the portfolio. Light mode uses light surfaces; dark mode uses dark surfaces. Existing opaque signature cards retain their gradients and artwork. Consistency means a shared readability and containment rule across sections, rather than removing backgrounds from one section or forcing every component to have identical artwork.

The correction to Why does not make its cards transparent: their existing gradient and white waves remain. Only the redundant external white backdrop is omitted. The same rule applies to any card that already supplies an opaque, readable surface.

## Root cause and correction

The actual main column remained 896px wide in the 1280px reproduction. The apparent expansion came from TextVeil rectangles, not a card layout change. DOM text bounds included translated carousel items outside their overflow viewport and decorative name-marquee copies. Nearby rectangles were then merged into large unions spanning empty space and the sidebar.

- Intersect measured text bounds with their own element and all overflow-clipping ancestors before merging.
- Ignore hidden, inert and decorative content.
- Merge only compact, substantially filled rectangles with compatible backdrop policy.
- Preserve opaque card footprints for creature avoidance without painting a second backdrop.
- Cache shared clipping ancestry/style reads during candidate refresh.

## Compared alternatives

Browser-only CSS prototypes were captured for Hero, Experience, Projects and Why at 1280x768 in light mode. They alter the supplemental text-protection layer, leaving the existing component surfaces and all interactions intact. This is a visual comparison, not a controlled GPU benchmark; the animated creature changes position between captures.

| Alternative | Observed tradeoff | Recommendation |
| --- | --- | --- |
| Bounded light surfaces | Clearest separation of navigation, text and scenery; may obscure more scenery where content is dense | Default; correct geometry and avoid duplicate backdrops |
| Translucent surfaces with 14px backdrop blur | More scenery colour remains visible, but large areas turn into diffuse colour clouds | Selective decorative treatment only; would need separate moving-background contrast and frame-time checks before adoption |
| No supplemental text backdrop | More visible creature detail, but headings, dates and navigation share the moving scene directly | Reject as the global default; existing cards alone do not protect all text |

Completely removing every card background was not implemented. These trials isolate the layer causing the reported defect. Automatic text inversion was not adopted: a changing foreground does not itself establish reliable contrast against every moving background, and can distract from reading.

## Shared rules

1. Text and controls have a stable readable surface; decoration can remain transparent.
2. A surface follows the visible content footprint and respects overflow boundaries.
3. Cards that provide their own opaque background do not receive a redundant external panel.
4. Preserve the approved tilt, carousel springs, role transitions and scene animation.
5. Keep keyboard focus outlines and the reduced-motion static presentation.

## Verification

- Root-cause regression suite: 5 new failures reproduced before the correction, then 70/70 focused cases passed.
- Full unit suite: 770/770 passed.
- Production browser suite: 42/42 passed, including light/dark moving-carousel and hero-marquee containment, existing accessibility audits and motion override.
- ESLint and production Webpack build passed.
- Build-artifact checks: 16/16 passed.
- Initial home JS is 203.7KB gzip against the 200KB target. Performance work remains open; this report does not approve release or claim a new Lighthouse score.

Reproduction scripts, measurements and before/after screenshots are local ignored QA artifacts under `.superpowers/sdd/2026-10-13-portfolio-koi-redesign/veil-debug/`.

## References

- [W3C contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): normal text needs at least 4.5:1 and large text 3:1 against its background.
- [MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter): the filter modifies the pixels behind a partially transparent element; it does not define a contrast guarantee.
