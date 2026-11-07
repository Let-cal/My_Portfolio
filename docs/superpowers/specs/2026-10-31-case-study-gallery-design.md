# Case study gallery (図) — design

Status: draft for owner approval, 2026-10-31 (builder check done). Owner choices: direction A + C (in-panel 絵巻 handscroll, full-screen
書院 viewer), one extra click to reach the images, diagrams stored as Mermaid and edited in the admin, rendering
approach 1 (rendered in the admin on save).

## 1. Intent

A recruiter reading a case study sees text only. Part 3 showed that the strongest evidence of the owner's work is
visual: real screens, and the architecture, data model and business flow the owner designed (SitePlus: 29 tables,
four Clean Architecture layers, a survey-to-matching flow). The design documents were lost, so the owner wants to
redraw them from the code and keep them editable without a drawing tool.

Who it serves:
- Recruiters and engineers: one click from the case study to the screens and diagrams, readable at any zoom.
- The owner: add, caption, reorder and edit images and Mermaid diagrams in the admin, in three languages.

## 2. Goals, non-goals, anti-goals

Goals
- A 図 (figures) view inside the existing 掛軸 case study panel, reached with one click, that keeps the panel's
  "no inner scrollbar at common desktop sizes" rule.
- A full-screen 書院 viewer for close reading: zoom, pan, an index by category, keyboard and button alternatives.
- Two figure kinds: an uploaded image, and a Mermaid diagram (source edited in the admin, SVG rendered on save).
- Captions and alt text in EN/JA/VI; categories 画 screen, 構 architecture, 表 data model (ERD), 流 flow, 他 other.
- Deep link to a figure: `?case=<id>&fig=<n>`.
- Initial content: SitePlus architecture, ERD and business flow diagrams (drawn from the code) plus its three
  screenshots; screenshots for Koi Portfolio, ZodiacGems and the course demo.

Non-goals
- No figures outside the case study panel (the home bento and the archive keep their single poster).
- No video figures in this change (`video_url` stays as it is).
- No automatic clean-up of storage files a replaced figure leaves behind (the media library lists them).
- No Mermaid rendering in a visitor's browser and no server-side rendering.

Anti-goals
- Any figure that shows a client's real screen or data (client projects get diagrams only, drawn generically).
- Loading the Mermaid library, or any figure code, before a visitor opens 図.
- An inner scrollbar in the desktop panel, clipped captions, or text that hides behind images.
- Drag or wheel as the only way to zoom or pan (WCAG 2.2 2.5.7).
- Script running from an uploaded or rendered SVG.

## 3. Constraints

- Next.js 16 Cache Components; content read through `get-content.ts` under the `content` tag; one Zod schema for
  seed, rows and admin forms (`src/content/schema.ts`), columns described once in `src/lib/data/columns.ts`.
- Home initial JS is 199.8 KB of a 200 KB gzip budget: nothing in this change may add to the home page's initial
  JS. The panel is already a lazy chunk; the 図 view and the viewer are further lazy chunks loaded on first use.
- The panel's fit rule (spec 2026-10-30 §6a): measured, never clipped; `data-mode="scroll"` on overflow.
- Motion only under `:root[data-motion="full"]`; reduced motion gets opacity changes of 150 ms or less.
- Font-subset budget tests scan all of `src`, comments included: new non-ASCII glyphs must already be in the
  repertoire or pass `npm run test:budgets` (the kanji used here are rendered by the Japanese font stack like the
  existing 果 and 掛軸; the builder confirms with the test, never assumes).
- Hosted Supabase is shared by preview and production: the migration is additive, reviewed SQL, run by the owner
  (ADR-0012); `apply_migration` and destructive SQL from the agent are declined at the permission layer.
- Admin writes stay admin-only under RLS; the read-only reviewer sees figures but cannot render or upload.

## 4. Approaches

UI direction (owner picked A + C)
- A 絵巻 handscroll in the panel: text slides out, one large figure, a filmstrip, ←/→. Chosen for reading flow.
- B 屏風 folding-screen bento grid: everything at once, small. Not chosen: thumbnails too small for diagrams.
- C 書院 full-screen viewer: index plus zoom and pan. Chosen as the close-reading step after A.

Mermaid rendering (owner picked 1)
1. **Chosen: render in the admin on save.** The admin edits the source with a live preview; on save the browser
   renders two themed SVGs (light, dark), sanitises them, uploads them to Storage and stores their URLs with the
   source. Visitors load a static SVG through `<img>`. Costs: re-render from the admin after a theme change.
2. Render in the visitor's browser: about 600 KB of Mermaid on first open, and inline SVG needs strict
   sanitising. Rejected.
3. Render on the server with the Mermaid CLI and headless Chromium on Vercel: heavy and fragile. Rejected.

## 5. Data model

New column `projects.media jsonb not null default '[]'` with `check (jsonb_typeof(media) = 'array')`.
Order in the array is display order. At most 12 figures per project.

```ts
// src/content/schema.ts
type FigureCategory = "screen" | "architecture" | "erd" | "flow" | "other";
type FigureBase = {
  id: string;                 // stable within the project, a-z0-9- (admin generates it)
  category: FigureCategory;
  caption: I18nText;          // required, at most 140 characters per locale
  note: I18nTextOptional;     // optional second line, at most 100 characters (e.g. "Redrawn from the code")
  alt: I18nText;              // required: what the image shows; for diagrams a text summary of the structure
};
type ImageFigure = FigureBase & { kind: "image"; url: string; width: number; height: number };
type DiagramFigure = FigureBase & {
  kind: "diagram";
  source: string;             // Mermaid, at most 20 000 characters; admin-only (never sent to visitors)
  svgLight: string;           // public Storage URL of the light rendering
  svgDark: string;            // public Storage URL of the dark rendering
  width: number;              // intrinsic size of the rendering, for layout and zoom
  height: number;
  renderedAt: string;         // ISO time; the admin marks diagrams rendered before the current theme version
  themeVersion: number;       // MERMAID_THEME_VERSION at render time
};
```

- Public mapping (`mappers.ts` and the view models) drops `source` (payload size only: the source is not secret,
  it describes the same diagram the SVG shows, and RLS lets anyone read project rows) and puts the remaining figure
  metadata on the case study item, which the tree and the archive already build from the page payload. No extra
  endpoint: figures travel with the case study data (a few hundred bytes each, never SVG content). The home bento
  does not open the panel and gets nothing new. The archive row shows a small `図 N` chip next to its case study
  button when N > 0 (Claude's call).
- Seed: two figures on one seed project (one image, one diagram with committed SVG files under `public/seed/`) so
  e2e runs without Supabase.
- Storage: images use the existing `media/image/<unique>-<slug>.<ext>` path; diagram renders go to
  `media/diagram/<project>-<figure>-<theme>-<hash8>.svg` (the hash of the SVG makes each render a new URL, so
  caches never serve a stale diagram).
- Version history works unchanged (the row's old `media` is kept); restoring an old version restores its URLs.

## 6. Public UI

### 6.1 Entry in the panel
- A segmented control in the panel head: `文 Content` | `図 Figures · N`. Shown only when N > 0. It is a pair of
  toggle buttons (`aria-pressed`), at least 24 px tall, keyboard reachable in reading order after the title.
- The spine keeps 図 with the figure position in kanji numerals (e.g. 図 二／六) while the 図 view is open.
- `?case=<id>&fig=<n>` (1-based) opens the panel straight on figure n; changing figure updates `fig` with
  `replaceState`; switching back to 文 removes it. An out-of-range `fig` opens figure 1.

### 6.2 絵巻 view (inside the panel)
Layout (desktop tiers ≥1024 px, both existing tiers): the region that holds the result banner and the three panes
is replaced by, top to bottom:
1. Stage: the current figure, `object-fit: contain`, on a washi-tinted surface; category seal top left
   (e.g. 構 Architecture), "⤢ Enlarge" button top right, ‹ › buttons on the sides.
2. Caption (up to two lines; a longer caption ends in an ellipsis here and is shown in full in the viewer) and
   note (one line, muted).
3. Filmstrip: one thumbnail per figure with its category kanji; the current one outlined in koi orange; a
   position label "2 / 6".
The stage takes the space left after caption and filmstrip; its height comes from the panel, never from the
image. The fit check from the 文 view applies unchanged: if the panel overflows, `data-mode="scroll"`.

Small screens (<1024 px or <680 px tall, the existing scroll mode): stage full width at 16:10, filmstrip scrolls
horizontally with snap, caption below; tapping the stage opens the 書院 viewer.

Behaviour
- ←/→ (and the ‹ › buttons) move between figures while 図 is open; Home/End jump to first/last. At the ends the
  buttons are disabled; no wrap. Previous/next project stays on its own buttons. Ruling: in 図, arrow keys belong
  to figures because the visitor is looking at them. Moving to another project while 図 is open keeps 図 on its
  figure 1 when that project has figures, and falls back to 文 when it has none (Claude's call).
- The filmstrip is a `role="tablist"` with roving tabindex; each thumbnail is a tab controlling the stage
  (`role="tabpanel"`).
- Enter on the stage, the Enlarge button, or a click on the figure opens the 書院 viewer on the same figure.
- Diagrams show the light or dark rendering that matches the site theme; the other rendering is not downloaded.
- Images are uploaded as WebP at most 1920 px wide and served at one size (the Supabase image render endpoint
  needs a paid plan; this project is on the free plan), `loading="lazy"` except the current figure, explicit
  width/height so nothing shifts.
- Loading: a washi skeleton in the reserved box. Failure: the box shows "Could not load this figure" with a Retry
  button; the rest of the view keeps working.
- An aria-live region announces "Figure 2 of 6: <caption>" on change.

Motion (full motion only)
- 文 → 図: the panes slide 24 px left and fade out (180 ms); the stage unrolls from the right edge with
  `clip-path: inset(0 0 0 100%) → inset(0)` (420 ms, cubic-bezier(.2,.7,.2,1)); thumbnails rise in with a 30 ms
  stagger. 図 → 文 plays it in reverse, faster (exit 240 ms).
- Figure change: the old figure fades and drifts 12 px against the direction of travel, the new one fades in
  (220 ms). Rapid presses cancel the running transition, never queue.
- Reduced motion: opacity only, at most 150 ms.

### 6.3 書院 viewer (full screen)
- A second Radix dialog above the panel (focus trapped, `aria-modal`, labelled "<project> — <caption>"), ink
  backdrop. Esc or ✕ returns to the 図 view on the figure being viewed, focus back on the stage.
- Left: index grouped by category with counts (画 Screens · 3); the current figure highlighted. Under 1024 px the
  index becomes a row of category chips above the canvas.
- Centre: canvas with the figure, fitted on open.
  - Zoom: wheel (zooms at the pointer), pinch, double-click (toggles fit and 100%), and buttons − / + / Fit / 100%;
    keys `+` `-` `0` (fit) `1` (100%). Range: fit to 400%.
  - Pan: drag, one-finger drag when zoomed, arrow keys when the canvas has focus, and four pan buttons revealed
    when zoomed beyond fit (single-pointer alternative).
  - A minimap (bottom right) appears when zoomed beyond fit, showing the visible area; clicking it moves there.
- Bottom: caption, note, "2 / 6", ‹ › buttons; ←/→ change figure when the canvas is not zoomed (when zoomed,
  arrows pan; PageUp/PageDown change figure).
- Motion: opening scales the figure from its place in the stage to the canvas (FLIP, 320 ms) while the backdrop
  fades in; closing reverses in 240 ms. Reduced motion: fade only.

### 6.4 Copy (EN shown; JA and VI in the message files)
`Content`, `Figures`, `Enlarge`, `Close`, `Zoom in`, `Zoom out`, `Fit`, `Actual size`, `Pan left/right/up/down`,
`Figure {n} of {count}`, `Could not load this figure`, `Retry`, category names `Screens`, `Architecture`,
`Data model`, `Flow`, `Other` with their kanji 画 構 表 流 他.

## 7. Admin

A new section "Hình ảnh & sơ đồ" in the project form (after Case study), field kind `figures`.

List
- Each row: thumbnail, category kanji, caption (VI), kind, a status badge for diagrams ("Cần vẽ lại" when
  `themeVersion` is older than the current theme), and actions: Edit, Move up, Move down, Delete. Drag to reorder
  as well (buttons are the accessible alternative).
- "Thêm ảnh" opens the existing MediaBrowser (pick or upload); width and height are read from the image.
- "Thêm sơ đồ" opens the diagram editor.

Diagram editor (a sheet)
- Left: Mermaid source (monospace textarea, line numbers optional), a template menu (Architecture `flowchart LR`,
  ERD `erDiagram`, Flow `flowchart TD`/`sequenceDiagram`).
- Right: live preview rendered with the portfolio theme, light/dark toggle; the preview updates 400 ms after
  typing stops. Mermaid is loaded only here (dynamic import in the admin).
- A syntax error shows the parser message and line under the source; the last good preview stays visible, dimmed.
- Caption, note and alt in EN/JA/VI with the existing per-locale validation messages; category select.

Save
- On "Lưu" of the project form, every diagram whose source or theme changed is rendered twice (light, dark),
  sanitised (DOMPurify SVG profile plus an element allowlist; no `script`, no `foreignObject` at all since labels
  are SVG text, no event attributes or external references), uploaded through a server action that re-checks admin, type `image/svg+xml`, size ≤ 1 MB and the
  same sanitising rules, then the URLs are written into the figure before the row is saved.
- If rendering or upload fails, the save stops with a message naming the figure, and nothing is written.
- "Vẽ lại tất cả sơ đồ" on the list re-renders every diagram with the current theme in one save.
- The reviewer role sees the list and the previews read-only; no render, upload or save controls.

Validation (Vietnamese, field-level, like the rest of the admin)
- Caption and alt required in EN (JA/VI fall back to EN, as elsewhere); lengths as in §5.
- Image figure: URL must be an uploaded media URL. Diagram: source required, must render without error.
- At most 12 figures.
- Work (client) projects: adding an image figure shows a warning that client screens and data must not be shown;
  it does not block (Claude's call; the owner decides case by case).

## 8. Theme for Mermaid

Diagram labels are in English (owner choice): one source per diagram; captions, notes and alt stay in three
languages. Labels use SVG text (`htmlLabels: false`) and the renderer embeds a Latin subset of Space Grotesk as a
`data:font/woff2` `@font-face` inside each SVG, so the text is measured and drawn with the same font on every
machine. The sanitiser allows exactly that: `data:font/woff2` URLs inside the SVG's own `<style>`, nothing else.

`src/lib/figures/mermaid-theme.ts` exports `MERMAID_THEME_VERSION` and two `themeVariables` sets built from the
site tokens: transparent background, node fill = card colour, node border = border token, lines and arrows =
koi orange at 70%, text = foreground, font = Space Grotesk, ER attribute rows alternating card/muted. Changing
the theme bumps the version; the admin then flags older diagrams.

## 9. Initial content (after the feature ships)

Authorship (answered by the owner during part 3): on SitePlus the owner wrote the SRS, basic and detailed design,
drew the architecture and designed the database; teammates implemented the .NET back end. The backend code is in
the private repository SitePlus-Graduation-project/SitePlus-BE (a local clone was read for part 3), so the
architecture and ERD can be drawn from it and presented as the owner's design, with the note naming the
teammates' implementation.


- SitePlus: 構 architecture (clients → .NET 8 API in four layers → SQL Server, Qdrant + Cohere, SignalR via Azure,
  Cloudinary, Gmail SMTP, QuestPDF); 表 ERD of the 29 tables in their 9 groups (one diagram, or two if it does not
  read at fit size: core flow tables and catalogue tables); 流 the survey-to-matching flow with its statuses;
  three web screenshots (sample data, as in the README).
- Koi Portfolio: two screenshots (light, dark) and 構 the runtime diagram from the README.
- ZodiacGems and the course demo: their README screenshots.
- Prerequisite (owner choice): ZodiacGems and Meet My Lecturer have no case study, so the panel cannot open for
  them. Before their figures go in, Claude drafts a four-part case study for each in EN/JA/VI from the
  repositories' READMEs and code, the owner approves it, and it is written as reviewed SQL like part 3. No
  "figures only" panel state is built.
- Client projects: no figures in this change (the owner may add generic diagrams later).
- The Mermaid sources are written by the builder from the code and the README, reviewed by the owner, and entered
  through the admin (or by a one-off script that uses the same render, sanitise and upload path with headless
  Chromium; never by hand-written SQL with SVG inside).

## 10. Quality bar

- Lighthouse a11y gate and axe e2e stay green; focus visible on every control; targets ≥ 24 px.
- Home initial JS unchanged; `/en/projects` stays under budget; the 図 chunk and the viewer chunk are lazy and each
  ≤ 25 KB gzip (measured in the bundle check).
- e2e: open 図 from the tree and the archive, change figure by key and button, deep link `fig`, open the viewer,
  zoom with buttons, Esc back to the same figure, reduced motion, small-screen layout; admin: add an image, add a
  diagram with a syntax error then a fixed one, reorder with buttons, save renders and uploads (stubbed storage in
  the disposable-DB job).
- Unit: schema and mappers (source never public), figure navigation and `fig` parsing, zoom/pan clamping, SVG
  sanitiser (rejects script, event attributes, external hrefs), theme-version flagging.

## 11. Left to the builder

- Pan/zoom implementation (own pointer-event code or a small library) within the chunk budget.
- Exact thumbnail size, skeleton texture, and the minimap drawing.
- Whether the one-off content script is worth it versus entering the diagrams through the admin.
