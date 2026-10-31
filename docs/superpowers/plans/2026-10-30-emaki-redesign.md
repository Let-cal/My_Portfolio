# Emaki Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recruiter-readable, Japanese-styled experience tree (company → stint → projects, mini Gantt), archive in year groups, a no-scroll 掛軸 case study panel, and an ink-thread side navigation.

**Architecture:** Pure selectors grow to describe the new structures:
- `src/lib/journey.ts` gains stints, the timeline and short titles.
- `src/lib/format.ts` gains durations.
- `src/lib/archive.ts` gains year groups and stint labels.
- A new `src/lib/case-list.ts` handles previous/next and `?case=`.

Client components render those structures:
- One shared, dynamically loaded `CaseStudyPanel` replaces `CaseStudySheet` everywhere.
- `JourneyTree`, `ProjectArchive` and `SideRail` are reworked in place.

Motion uses CSS, WAAPI and existing `motion` only where already loaded. The side rail uses plain DOM and SVG.

**Tech Stack:** Next.js 16 (Cache Components, next-intl), React 19, Tailwind 4, motion, Radix Dialog (`radix-ui`), Vitest + Testing Library, Playwright + axe, Lighthouse CI.

**Spec:** `docs/superpowers/specs/2026-10-30-emaki-redesign-design.md`. Read §5 and §6a; it builds on
`docs/superpowers/specs/2026-10-27-experience-tree-and-projects-design.md`.

**Mockups (visual reference, not code to copy):** `../.superpowers/brainstorm/4-1793349475/content/`. The path is
relative to the repo root; on disk it is `C:/Users/PC/Documents/03_Projects/Web/Portfolio/.superpowers/...`.
- `emaki-direction.html`: the tree and the archive.
- `drawer-hybrid.html`: the panel.
- `sidenav-options.html`: option A is the nav.

## Global Constraints

- Branch `feat/emaki-redesign`, stacked on `feat/experience-tree-projects`.
- Run `npm run verify` before every push. No Claude attribution lines in commits or PRs.
- **No new dependencies. No data-model, migration or seed-schema change.**
- **Initial JS ≤ 200 KB gzip** on `/` and `/[locale]/projects` (`node scripts/measure-initial-js.mjs` after
  `npm run build`).
  - `/` has about 1.3 KB headroom.
  - The panel stays `dynamic(..., { ssr: false })`.
  - New home code in the initial chunk must be minimal. Gantt hover-sync, the archive hover preview and the nav
    peek card may be deferred.
- Never use port 3000. Playwright uses 3100. Never `taskkill /IM node.exe`.
- Anchors stay:
  - `#exp-<slug>` (parents);
  - `#tree-<id>` (tree children);
  - `#proj-<id>` (bento);
  - `row-<id>` (archive);
  - hash deep links keep working.
- No published text leaves the DOM. Disclosures collapse visually and keep the text in the DOM. There is no
  ellipsis clamp on case-study text.
- Decorative kanji: `aria-hidden="true"` with `lang="ja"`. Facts stay in Latin and Arabic digits.
- Reduced motion (the OS setting and the site's motion toggle, as existing components read it) means no movement.
  Content is complete within 500 ms of any open.
- Every new string goes in `src/messages/{en,ja,vi}.json`. Light and dark tokens for every new colour.
- Do not use Shippori Mincho or Zen Old Mincho. Serif text uses the existing serif stack, or Noto Serif JP for kanji.
- Motion timings (spec §5):
  - Tree parent: opens in 360 ms, closes in 220 ms; rows stagger 40 ms, capped at 6.
  - Hanko stamp: 260 ms, scale 1.35 → 1.
  - Panel:
    - unroll 450 ms;
    - result band at 150 ms;
    - panes stagger 60 ms from 220 ms;
    - seal at 420 ms, lasting 260 ms;
    - close is a 180 ms fade.

## Review Focus

1. A long JA or VI case study at 1024 × 680, or one added later in the admin, must switch the panel to scrolling
   one-column mode and never clip. Test in Task 2 (`switches to scroll mode when content overflows`) plus the e2e
   fit test.
2. `?case=` with an unknown id, a project without a case study, or an unpublished project must be ignored without
   errors, and the URL cleaned. Test in Task 1 (`parseCaseParam`) and Task 2.
3. A company with one stint, or with stints but no projects (FPT Japan), gets no promotion marker, no Gantt and no
   empty stint headers. Test in Task 1 and Task 3.
4. The archive filter applied by the inline script before hydration must also hide empty year groups, with no
   flash and no CLS. Test in Task 4 (CSS `:has` rule plus e2e).
5. The side rail when the page is resized or fonts load late, so its offsets change: the path is rebuilt and the
   fill still lands on the active item. Test in Task 5 (ResizeObserver rebuild unit test plus e2e).

---

### Task 1: Selectors: durations, stints, timeline, short titles, archive groups, case lists

**Files:**
- Modify: `src/lib/format.ts`
- Modify: `src/lib/journey.ts`
- Modify: `src/lib/archive.ts`
- Create: `src/lib/case-list.ts`
- Tests:
  - `tests/unit/format.test.ts`
  - `tests/unit/journey.test.ts`
  - `tests/unit/archive.test.ts` (new, or extend the existing archive tests if they exist elsewhere)
  - `tests/unit/case-list.test.ts` (new)
- Messages: `common.duration` plurals and `experience.intern` (Intern / Thực tập / インターン).

**Interfaces (Produces):**
- `monthsBetween(start: string, end: string | null, now?: Date): number`
  - Counts inclusive months.
  - `null` means up to the current month.
- `formatDuration(start: string, end: string | null, locale: Locale, now?: Date): string`
  - EN: "1 yr 2 mos", "3 mos", "1 yr".
  - VI: "1 năm 2 tháng".
  - JA: "1年2か月".
- `shortTitle(position: string): string`
  - Cuts before the first "—", ",", "(", "（" or "、" and trims.
- In `journey.ts`:
  - `type JourneyStint = { id; title; shortLabel; period; duration; start; end: string | null; employmentType; promotedFrom: string | null /* month label when the previous (older) stint was an internship and this one is not */; children: JourneyChild[] }`
  - `JourneyParent` gains:
    - `stints: JourneyStint[]`: companies only, newest first. A child without a matching stint goes into a final
      stint with `id: ""` and an empty title.
    - `duration: string`.
    - `summaryLabel: string | null`: "Intern → Software Engineer", the short labels oldest → newest, only when a
      promotion exists.
    - `timeline: Timeline | null`: only when the company has ≥ 2 children.
  - `type Timeline = { start: string; months: number; axis: { label: string; index: number }[]; segments: { id; label; from: number; to: number }[]; bars: { id; anchor; title; from: number; to: number }[] }`
    - `from` and `to` are fractions in [0, 1] of the month axis; an end month counts inclusively.
  - `JourneyChild` gains:
    - `result: string | null`: the localized `caseStudy.result`;
    - `duration: string`;
    - `stintId: string | null`.
  - Keep `children` on the parent as the flat list (newest first) for existing anchors and tests.
- `archive.ts`:
  - `ArchiveRow` gains `stintLabel: string | null` (the work project's stint short label; the internship word for
    internships).
  - `groupByYear(rows: ArchiveRow[]): { year: string; rows: ArchiveRow[] }[]`, newest year first, order inside
    kept.
- `case-list.ts`:
  - `type CaseContext = "tree" | "bento" | "archive"`
  - `caseIds(items: { id: string; caseStudy: unknown | null }[]): string[]` keeps only items with a case study, in
    order.
  - `neighbours(ids: string[], id: string): { prev: string | null; next: string | null; index: number; total: number }`
    is circular when `total > 1`.
  - `parseCaseParam(search: string, known: ReadonlySet<string>): string | null`
  - `CASE_PARAM = "case"`

- [ ] **Step 1: Write the failing tests.**
  - `format.test.ts`:
    - `formatDuration counts inclusive months` (2025-08..2026-09 → EN "1 yr 2 mos", VI "1 năm 2 tháng", JA "1年2か月")
    - `formatDuration single month` (2024-03..2024-03 → "1 mo" / "1 tháng" / "1か月")
    - `formatDuration open-ended uses now`
  - `journey.test.ts`, using `src/content/seed.json`:
    - `groups SKG projects under their stint`: engineer gets [skg-ai-agent, skg-flexybox-p2, skg-coa]; intern gets
      [skg-flexybox-p1, tongue-ai-driver-ms].
    - `marks the promotion from internship`: the engineer stint has `promotedFrom` = "Oct 2025".
    - `summary label lists short titles oldest first`: "Intern → Software Engineer" in EN.
    - `no timeline or promotion for FPT Japan`: `timeline === null`, one stint, `summaryLabel === null`.
    - `timeline bars are month fractions`: the SKG axis spans 14 months; tongue-ai-driver-ms has `from` 0 and
      `to` 2/14.
    - `shortTitle cuts at the first separator` covers the three locale examples.
  - `archive.test.ts`:
    - `groupByYear newest first`
    - `stintLabel for work rows`
  - `case-list.test.ts`:
    - `caseIds skips projects without a case study`
    - `neighbours wraps around`
    - `parseCaseParam ignores unknown ids`
    - `parseCaseParam reads ?case=`
- [ ] **Step 2:** Run `npx vitest run tests/unit/format.test.ts tests/unit/journey.test.ts tests/unit/case-list.test.ts`.
  Expected: FAIL (functions missing).
- [ ] **Step 3:** Implement the interfaces above, and add the message keys in all three locales.
- [ ] **Step 4:** Run the same tests plus `npx vitest run`. Expected: all PASS. Existing tree and archive tests stay
  green.
- [ ] **Step 5:** Commit `feat(journey): stints, timeline, durations and case lists for the Emaki redesign`.

### Task 2: 掛軸 case study panel (replaces CaseStudySheet everywhere)

**Files:**
- Create: `src/components/sections/case-study/CaseStudyPanel.tsx`. Put the `CaseStudyView` type here and re-export
  it from the old path, or update the imports.
- Create: `src/components/sections/case-study/use-case-param.ts`
- Delete: `src/components/sections/experience/CaseStudySheet.tsx` (update every import)
- Modify:
  - `src/components/sections/experience/JourneyTree.tsx` (panel wiring only)
  - `src/components/sections/projects/ProjectsBento.tsx`
  - `src/components/sections/projects/ProjectCard.tsx` (type import)
  - `src/components/sections/projects/ProjectArchive.tsx` (panel wiring only)
- Messages `caseStudy.*`: `result`, `copyLink`, `copied`, `prev`, `next`, `position` ("{index} of {total}"),
  `chapterTree` / `chapterProjects` (kanji labels are static, not translated), `where`, `period`.
- Tests:
  - `tests/unit/case-study-panel.test.tsx` (new)
  - `tests/e2e/case-study-panel.spec.ts` (new)

**Interfaces:**
- Consumes: `neighbours`, `parseCaseParam` and `CASE_PARAM` from Task 1.
- Produces:
  - `type CaseStudyItem = { id; title; where: string; stint: string | null; role: string; teamSize: string | null; period: string; duration: string; kindLabel: string; caseStudy: CaseStudyView; tech: string[]; demoUrl: string | null; repoUrls: string[] }`
  - `CaseStudyPanel` props: `{ items: CaseStudyItem[]; openId: string | null; context: CaseContext; onOpenChange(id: string | null): void; returnFocusRef: RefObject<HTMLElement | null> }`
    - `items` are only those with a case study, in list order.
  - `useCaseParam(items, setOpenId)`:
    - reads `?case=` once after hydration;
    - writes it with `history.replaceState` on open and close.

**Behaviour:**
- Radix Dialog with focus trap, Esc and return focus.
- Structure per spec §5.4:
  - spine (`aria-hidden`), header with the meta row and actions;
  - result banner with the 果 seal;
  - three panes;
  - footer with all tech and previous/next buttons named with the neighbour titles.
- Layout tiers per §6a.1, plus a `ResizeObserver`. When the content scrollHeight is greater than clientHeight in
  wide mode, set `data-mode="scroll"`: one column, thin scrollbar, fade masks.
- ←/→ go to the previous/next project when the event target is not an input, textarea or contenteditable.
- "Copy link" uses `navigator.clipboard.writeText` with the `?case=` URL, plus the existing sonner toast. If it
  fails, it shows the URL in the toast.

**Steps:**
- [ ] **Step 1: Write the failing unit tests**, with Testing Library and `matchMedia`/`ResizeObserver` stubs:
  - `renders result first then problem role decisions`
  - `lists every tech chip`
  - `next button names the next project and moves to it`
  - `arrow keys move between projects but not inside inputs`
  - `switches to scroll mode when content overflows` (stub the content `scrollHeight > clientHeight`, expect
    `data-mode="scroll"`)
  - `ignores an unknown ?case= id and removes it from the URL`
  - `opens from ?case= on load`
- [ ] **Step 2:** Run `npx vitest run tests/unit/case-study-panel.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement the panel and the hook, and wire them into the tree, the bento and the archive. Each
  passes its own `items`, built from its rows/children/cards that have a case study, and its `context`.
- [ ] **Step 4: Write the e2e** `case-study-panel.spec.ts`:
  - It opens from the tree, the bento and the archive.
  - Esc returns focus to the opener.
  - `?case=skg-coa` opens on load.
  - **Fit test:** at 1366 × 768 and 1440 × 900, for each seed case study in `en` and `vi`, the content element
    reports `data-mode="wide"`, and `scrollHeight <= clientHeight + 1`.
  - axe passes on the open panel in light and dark.
- [ ] **Step 5:** Run `npx vitest run`, then `npx playwright test tests/e2e/case-study-panel.spec.ts` with the
  repo's Playwright config (port 3100). Expected: PASS. If the fit test fails, reduce the pane type size toward
  14 px and the spacing (never below 14 px) until it passes.
- [ ] **Step 6:** Commit `feat(case-study): kakejiku panel with fit-or-scroll layout, deep links and prev/next`.

### Task 3: Experience tree: stints, Gantt, ink rail, hanko, compact rows

**Files:**
- Modify: `src/components/sections/experience/JourneyTree.tsx`. Split out `JourneyTimeline.tsx` and
  `InkRail.tsx` (or similar).
- Modify: `src/components/sections/Experience.tsx` if props change.
- Messages `experience.*`: `promoted` ("Promoted to full-time · {month}"), `positionsCount`, `showDescription`,
  `hideDescription`, `timelineLabel` (the accessible summary sentence).
- Tests:
  - `tests/unit/journey-tree.test.tsx`
  - `tests/e2e/experience-tree.spec.ts`

**Behaviour (spec §5.1–5.2):**
- A parent header shows:
  - the name;
  - the period with its duration;
  - the location, or "Education";
  - chips: projects count, positions count when there is more than one, and `summaryLabel`; the GPA for schools.
- Inside a company: the `JourneyTimeline` when `timeline` is not null, then one `<section aria-labelledby>` per
  stint with its children.
  - The heading `h4` holds the stint title, period and duration.
  - Between stints there is a promotion connector when `promotedFrom` is set.
- Schools keep a flat child list.
- Child row:
  - title, period with duration, role, team size;
  - the result line in full when present;
  - ≤ 5 chips then "+N";
  - a "Show description" disclosure (`aria-expanded`, the summary kept in the DOM, collapsed with grid rows and
    `inert` when closed);
  - "Case study →" (opens the Task 2 panel with the tree's `items`).
  - It keeps `id={anchor}`, `data-journey-child` and the role highlight.
- `JourneyTimeline`:
  - `role="img"` with an `aria-label` from `timelineLabel`;
  - the axis labels, the stint lane and one bar per project.
  - Hovering or focusing a child row and the bar with the same id toggles `data-lit` on both (delegated listener,
    no React state per hover).
  - Clicking a bar scrolls its row into view.
  - Under 640 px the in-bar labels are hidden.
  - It may be deferred after first paint (budget).
- Ink rail: an SVG path down the left (slight sway). The fill follows scroll progress through the tree (a clip or
  `stroke-dashoffset` on a duplicate path, written in rAF). It replaces the gradient span and `TracingBeam` here.
  Static and fully drawn under reduced motion.
- Hanko per parent: the kanji year (二〇二六) of the parent's end (the current year if open-ended), `aria-hidden`.
  Filled when open, outlined when closed. It stamps once when it first enters the viewport.
- Open and close: `grid-template-rows` with `clip-path: inset()` at the spec timings. Children stagger through a
  CSS `--i` delay capped at 6. Instant under reduced motion.
- Cards: washi grain at 4%, and an ink-bleed hover/focus-within glow replacing `GlowCard`.

**Steps:**
- [ ] **Step 1: Write the failing tests** in `journey-tree.test.tsx`:
  - `renders stints with their projects under them`
  - `shows the promotion connector between intern and engineer`
  - `description disclosure keeps text in the DOM`
  - `timeline has an accessible label and one bar per project`
  - `FPT Japan has no timeline and no stint headings`
  - `hovering a row lights its bar`
  - Existing anchor and hash tests stay.
- [ ] **Step 2:** Run `npx vitest run tests/unit/journey-tree.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Update `tests/e2e/experience-tree.spec.ts`:
  - stints visible under SKG;
  - keyboard expand and collapse;
  - `#tree-skg-coa` and `#exp-fpt-university` deep links;
  - Gantt sync on hover;
  - axe in light and dark;
  - reduced-motion run.
- [ ] **Step 5:** Run `npx vitest run`, then the tree e2e. Expected: PASS.
- [ ] **Step 6:** Commit `feat(experience): stint groups, mini timeline, ink rail and hanko`.

### Task 4: Archive in year groups with animated filtering

**Files:**
- Modify: `src/components/sections/projects/ProjectArchive.tsx`
- Modify: `src/lib/archive-filter.ts` (CSS so empty year groups hide)
- Modify: `src/app/[locale]/projects/page.tsx` (heading line "N projects · Y1 – Y2")
- Messages `archive.*`: `summary`, `stint`.
- Tests:
  - `tests/unit/project-archive.test.tsx`
  - `tests/e2e/projects-archive.spec.ts`

**Behaviour (spec §5.3):**
- The table becomes year groups:
  - `<section aria-labelledby="year-<y>">`, with a sticky serif year and the kanji year `aria-hidden`.
  - Inside it, a `<ul>` of rows.
  - Each row keeps `id="row-<id>"`, `data-archive-kind` and the role highlight.
  - Columns in the row: title (★ vermilion seal for featured, with an sr-only label), Where (kind badge, parent name,
    `stintLabel`), tech (3 then +N), and action/links.
  - The case study opens from a full-row button overlay, as today.
- `ARCHIVE_FILTER_CSS` also hides `[data-archive-year]` groups with no visible row, via `:has()`. A fallback for
  browsers without `:has` is acceptable as "group header stays".
- The chips' active pill slides. Filtering does a manual FLIP with WAAPI (`element.animate`): measure, apply the
  attribute, measure, animate the transforms over 300 ms. Rows that appear fade in. No animation under reduced
  motion.
- Hover preview:
  - Only for `(hover: hover) and (pointer: fine)` without reduced motion.
  - One fixed 220 × 136 card, `aria-hidden`, following the pointer with a lerp in rAF.
  - It shows `posterUrl` (when the row has it; add `posterUrl` to `ArchiveRow`) or a gradient card with the title.
  - On keyboard focus it is anchored to the row's right edge.
  - It may be deferred.
- Opening the panel: when `document.startViewTransition` exists and motion is allowed, wrap the state change. The
  row title and the panel title share `view-transition-name: case-title` (set only during the transition).

**Steps:**
- [ ] **Step 1: Write the failing tests:**
  - `groups rows by year newest first`
  - `year group hides when the filter empties it` (assert the CSS string has the `:has` rule, plus the e2e)
  - `featured row shows the seal with an accessible label`
  - `where shows the stint label for work projects`
  - `?kind= and #row- deep links still work` (existing tests updated)
- [ ] **Step 2:** Run `npx vitest run tests/unit/project-archive.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Update `tests/e2e/projects-archive.spec.ts`:
  - filter chips change the visible rows and hide empty years;
  - a reload with `?kind=university` shows no flash;
  - axe passes;
  - no horizontal scroll at 375 px.
- [ ] **Step 5:** Run `npx vitest run`, then the archive e2e. Expected: PASS.
- [ ] **Step 6:** Commit `feat(archive): year groups, sliding filter, FLIP rows and hover preview`.

### Task 5: Side navigation: 墨の糸 ink thread

**Files:**
- Modify: `src/components/site/SideRail.tsx`
- Create: `src/components/site/ink-thread.ts` (the pure path builder and position maths)
- Modify: `src/components/site/sections.ts` (add the single-character numerals `序 一 二 三 四 五 終` to
  `SECTION_CHAPTERS` as `numeral`)
- Messages: `nav.peek.<id>` in all three locales.
- Tests:
  - `tests/unit/ink-thread.test.ts` (new)
  - `tests/unit/side-rail.test.tsx` (new or existing)
  - an e2e in `tests/e2e/public.spec.ts` or a new `side-rail.spec.ts`

**Interfaces:**
- `buildThreadPath(ys: number[], x: number, sway: number): string`: a cubic path through each y.
- `threadPosition(ys: number[], activeIndex: number, progress: number): number`: the y between item `i` and
  `i + 1` by progress.
- `chapterProgress(rect: DOMRectReadOnly, readingLine: number): number`, clamped to [0, 1].

**Behaviour (spec §5.5):**
- Each item: `numeral` (`aria-hidden`, `lang="ja"`, serif), the label (unchanged text and `aria-current`), and a 1 px
  progress hairline (`scaleX` from the CSS variable `--sp`).
- A base path plus an accent path revealed by `clip-path: inset(0 0 <h - y>px 0)`. An ink drop sits at y.
- The ink colour is `var(--role-accent)` until `why`, and teal from `why` on. Reuse the `ScrollProgressKoi` trigger
  or the same section check.
- A `ResizeObserver` (and `document.fonts.ready`) rebuilds the path.
- Scroll writes styles in rAF only. React state changes only through `useActiveSection`.
- "All projects" is a dashed spur with ↗. On `/projects` it is inked and keeps `aria-current="page"`.
- The peek card appears on `:hover` and `:focus-visible` via CSS (no JS). It is decorative: `aria-hidden`.
- Reduced motion: no transitions; the positions are still set.
- No `motion` import.

**Steps:**
- [ ] **Step 1: Write the failing tests:**
  - `buildThreadPath passes through every y`
  - `threadPosition interpolates inside the active chapter`
  - `chapterProgress clamps`
  - In `side-rail.test.tsx`:
    - `renders numerals hidden from assistive tech`
    - `keeps aria-current on the active section`
    - `rebuilds the path on resize` (ResizeObserver stub)
- [ ] **Step 2:** Run `npx vitest run tests/unit/ink-thread.test.ts tests/unit/side-rail.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4: E2E** at 1440 × 900:
  - scrolling to `#projects` sets `aria-current` on Projects;
  - the ink drop's top lies between the Projects item and the next one;
  - axe passes.
- [ ] **Step 5:** Run `npx vitest run` and the e2e. Expected: PASS.
- [ ] **Step 6:** Commit `feat(nav): ink-thread chapter navigation with per-chapter progress`.

### Task 6: Budgets, full verification and docs

**Files:**
- Modify as needed: dynamic imports for deferrable pieces.
- Modify: `docs/` (the architecture or README section that describes Experience and Projects, if one exists).
- Modify: `lighthouserc` or the equivalent config so `/[locale]/projects` stays audited (it should already be).

- [ ] **Step 1:** Run `npm run build` then `node scripts/measure-initial-js.mjs`. Expected: both routes ≤ 200 KB.
  If over budget, defer the Gantt hover-sync, the hover preview and the peek logic with `dynamic` or an
  idle-callback import until it passes.
- [ ] **Step 2:** Run `npm run verify` (lint, types, unit, budgets). Expected: PASS.
- [ ] **Step 3:** Run the full Playwright suite on port 3100. Expected: PASS, including axe in light and dark, the
  motion spec and the mobile layout.
- [ ] **Step 4:** Update the docs that describe these sections (a short paragraph, no marketing copy).
- [ ] **Step 5:** Commit `chore: keep Emaki redesign within budgets; docs`.
