# ADR-0014: Case-study diagrams are rendered in the admin on save

- Status: Proposed (branch `feat/case-study-gallery`, not merged yet)
- Date: 2026-10-31

## Context

Case studies were text only. The strongest evidence of the owner's work is visual: real screens, and the architecture, data model and business flows the owner designed. The original design documents were lost, so the diagrams are redrawn from the code and must stay editable without a drawing tool. Mermaid source is the editable format.

The home page's initial JavaScript was 199.8 KB of the 200 KB gzip budget ([ADR-0003](0003-3d-scene-never-blocks-content.md)). Mermaid is about 600 KB, and an SVG from an editor can carry script. Visitors must not pay for either: no figure code before a visitor opens the figures view, and no script from an uploaded or rendered SVG.

Three ways to render Mermaid were considered:

1. **Render in the admin on save.** The admin edits the source with a live preview. On save the browser renders two themed SVGs (light, dark), sanitises them, uploads them to Storage and stores their URLs next to the source. Visitors load a static SVG through `<img>`.
2. **Render in the visitor's browser.** About 600 KB of Mermaid on first open, and inline SVG would need strict sanitising on every page view. Rejected.
3. **Render on the server** with the Mermaid CLI and headless Chromium on Vercel. Heavy and fragile in a serverless function. Rejected.

## Decision

- **Option 1.** Diagrams are rendered in the admin when the project form is saved. Every diagram whose source or theme changed is rendered twice (light, dark). If rendering or upload fails, the save stops, names the figure and writes nothing.
- **Mermaid stays out of webpack.** `scripts/copy-mermaid.mjs` (prebuild, predev) copies Mermaid's self-contained build to the gitignored `public/vendor`; the admin loads it with a `<script>` tag on the first render. Public routes never import the renderer.
- **Visitors get static files.** A figure is an `<img>` of an uploaded image or of the rendered SVG for the current theme, so no SVG is inlined into the page and its script could not run anyway. The figures view and the full-screen viewer are separate lazy chunks, loaded on first use.
- **Font embedding rule.** Diagram labels are SVG text (`htmlLabels: false`). The renderer embeds the site's Space Grotesk woff2 as a `data:font/woff2;base64` `@font-face` inside each SVG, so labels are measured and drawn with the same font on every machine. The sanitiser allows exactly that: a `data:font/woff2` URL inside the SVG's own `<style>`, and otherwise only `#fragment` references. Script, event attributes, every `foreignObject` (the element allowlist has none) and external references are refused, in the browser before upload and again by the server before the row is saved.
- **Theme version.** `MERMAID_THEME_VERSION` in `src/lib/figures/mermaid-theme.ts` is stored with each diagram. Changing the theme bumps it, and the admin flags older diagrams for a re-render.
- **Budgets.** `npm run check:bundle` caps each figure chunk at 25 KB gzip, found through the build's loadable manifest, and fails when an entry is missing. The home routes' initial JavaScript must not grow.

## Consequences

Positive:

- Visitors download no Mermaid and no figure code until they open the figures view; a diagram costs one SVG request.
- The only renderer is the admin's browser, so there is no server rendering stack to keep alive.
- The stored SVG is checked twice, on the client and on the server, against one allowlist.

Negative / trade-offs:

- After a theme change, someone must re-render the diagrams from the admin ("Vẽ lại tất cả sơ đồ"). Until then visitors see the older rendering, flagged in the admin.
- Each SVG carries its own copy of the embedded font, so diagrams are larger than plain Mermaid output (the server refuses an SVG above 1 MB).
- Replaced SVGs stay in Storage; the media library lists them, and nothing cleans them up automatically.
- If a stored SVG cannot be loaded, the visitor gets an error message with Retry; there is no live rendering fallback.

## Evidence

- Design: sections 4 and 8 of [docs/superpowers/specs/2026-10-31-case-study-gallery-design.md](../superpowers/specs/2026-10-31-case-study-gallery-design.md).
- Renderer and safety: [`render-diagram.ts`](../../src/lib/admin/render-diagram.ts), [`sanitize-svg.ts`](../../src/lib/admin/sanitize-svg.ts), [`svg-safety.ts`](../../src/lib/figures/svg-safety.ts), [`figures-save.ts`](../../src/lib/admin/figures-save.ts), [`mermaid-theme.ts`](../../src/lib/figures/mermaid-theme.ts), [`copy-mermaid.mjs`](../../scripts/copy-mermaid.mjs).
- Public views: [`LazyFigureScroll.tsx`](../../src/components/sections/case-study/figures/LazyFigureScroll.tsx), [`LazyFigureViewer.tsx`](../../src/components/sections/case-study/figures/LazyFigureViewer.tsx).
- Migration: [`20261101090000_project_figures.sql`](../../supabase/migrations/20261101090000_project_figures.sql).
- Tests: [`svg-safety.test.ts`](../../tests/unit/svg-safety.test.ts), [`svg-safety-hardening.test.ts`](../../tests/unit/svg-safety-hardening.test.ts), [`svg-sanitize.test.ts`](../../tests/unit/svg-sanitize.test.ts), [`figures-save.test.ts`](../../tests/unit/figures-save.test.ts), [`mermaid-theme.test.ts`](../../tests/unit/mermaid-theme.test.ts), [`case-study-figures.spec.ts`](../../tests/e2e/case-study-figures.spec.ts), and the chunk budget in [`figure-chunks.test.mjs`](../../tests/scripts/figure-chunks.test.mjs) with [`measure-initial-js.mjs`](../../scripts/measure-initial-js.mjs).
