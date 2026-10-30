# Emaki redesign: experience tree, project archive, case study panel and side navigation — design

Status: draft for owner approval, 2026-10-30. It builds on `2026-10-27-experience-tree-and-projects-design.md`
(data model, migration and anchors are unchanged) and ships on a branch stacked on `feat/experience-tree-projects`
before that branch's rollout.

Mockups: `Portfolio/.superpowers/brainstorm/4-1793349475/content/`:
- `emaki-direction.html`: the tree and the archive. Approved direction ("Emaki", A–E).
- `sidenav-options.html`: side navigation, option A "墨の糸 Ink thread". Chosen.
- `drawer-hybrid.html`: the case study panel "掛軸 Kakejiku", a hybrid of the bento (C) and the two-column layout (A).
  Chosen. The earlier `drawer-options.html` holds the three single options for reference.

## 1. Intent

The owner judged the merged-but-unreleased tree, archive, case study sheet and side navigation too plain. They
do not show design skill, and they do not carry the site's identity: ancient, poetic Japanese with professional
software engineering.

They also found the information hard to read. The company header lists positions with dates, but nothing says
which project was done in which position. Recruiters scan for title, company and dates for about 7 seconds, in
an F pattern (TheLadders eye-tracking study). The redesign has to make the career readable at that speed first,
and look distinctive second.

## 2. Goals, non-goals, anti-goals

Goals
- Experience reads **company → position (stint) → projects**. Each project sits under the stint whose
  `experience_id` it carries, and the promotion between stints is visible.
- A mini timeline (Gantt) per company shows the stints and every project on one month axis, so overlap and
  progression read at a glance.
- Every surface carries the Japanese identity through line, colour, type and kanji numerals. Ink lines drawn by
  scroll, a single vermilion seal accent, washi grain, a hanging-scroll (掛軸) panel. No brush-texture images.
- A case study reads in full **without an inner scrollbar** on common desktop sizes.
- The side navigation becomes a chapter "ink thread" that shows where the reader is and how far they have read.

Non-goals
- No data-model or migration change; the 2026-10-27 migration ships as approved.
- No new content (part 3 of the overall request stays next).
- No horizontal pinned "scroll the whole section sideways" experience (the owner rejected it).
- The mobile header and its menu, the hero, Skills, Certificates, Why and Contact are not touched.

Anti-goals
- Kitsch: brush-script UI text, sakura, waves, Mt Fuji or torii decoration, a seal on every item, vertical text on
  facts recruiters must read, or daiji numerals (壱弐参).
- Hiding or truncating published text. Every word stays in the DOM. Text may sit behind a disclosure, but it is
  never clipped with an ellipsis and has no "read more" for the case study.
- Motion that carries meaning on its own, ignores reduced motion, causes layout shift, or blocks reading.
  Content must be complete within 500 ms of opening anything.
- Breaking the initial-JS budget.

## 3. Constraints

- Next.js 16 Cache Components, React 19, Tailwind 4, `motion` (already installed). No new dependencies.
- **Initial JS budget is ≤ 200 KB gzip on `/` and `/[locale]/projects`. `/` currently sits at about 198.7 KB, so
  there is about 1.3 KB of headroom.**
  - New home-page client code must be tiny or loaded after first paint.
  - The case study panel is already loaded with `dynamic(..., { ssr: false })`; it stays that way.
- Accessibility: WCAG 2.2 AA and axe-clean in light and dark. Keyboard operable throughout. `prefers-reduced-motion`
  honoured (with the site's own motion toggle). Kanji used as decoration are `aria-hidden` with `lang="ja"`.
- Light and dark themes. The mockups are dark only; the builder gives every new token a light-mode value.
- Three locales (EN/JA/VI). New UI strings go to `src/messages/{en,ja,vi}.json`.
  - Noto Serif JP is the only serif with a Vietnamese subset (verified against Google Fonts on 2026-10-30), so
    Latin and Vietnamese serif text keeps the existing serif stack.
  - Shippori Mincho and Zen Old Mincho must not be used for Vietnamese text.
- CLS ≤ 0.1, Lighthouse a11y and SEO gates, Playwright with axe, Lenis smooth scroll (its anchor handling stays
  as today).

## 4. Approaches considered

1. **Emaki, all five parts (chosen).** Information fixes, plus the Japanese visual layer and motion on the tree,
   the archive, the case study panel and the side navigation.
2. Refinement only: information fixes plus the panel, leaving visuals close to today. Rejected as not distinctive
   enough.
3. Pinned horizontal scroll ("unroll the whole section sideways"). Rejected: it hurts 7-second scanning, mobile
   and accessibility.

For the panel, three layouts were mocked:
- A: wide two columns.
- B: a stepper with one section at a time.
- C: a bento overview, which truncates text.

The owner preferred C's character and asked for it combined with A's completeness. The result is the
"Kakejiku" hybrid in §5.4.

For the navigation, three were mocked:
- A: an ink thread.
- B: a 栞 ribbon.
- C: a 落款 seal.

The owner chose A.

## 5. Decisions

### 5.1 Experience tree: information (A1–A5)

- `buildJourney` (`src/lib/journey.ts`) groups a company's children by stint. `JourneyParent` gains:
  - `stints: JourneyStint[]`, newest first. Each stint is
    `{ id, title, period, duration, start, end, employmentType, children: JourneyChild[] }`.
  - `duration`: the company span, formatted.
  - `timeline`: the data for the mini Gantt (axis start and end months, stint segments, one bar per child).

  A school keeps a single stint-less list (its degree line stays as today). A company child whose stint is
  missing is listed in a final group with no stint header. This cannot happen after the migration; it is a guard.
- Durations: `formatDuration(start, end, locale)` in `src/lib/format.ts`.
  - It counts inclusive months: Aug 2025 – Sep 2026 is 14 months.
  - Output by locale: EN "1 yr 2 mos", VI "1 năm 2 tháng", JA "1年2か月".
  - Open-ended spans count up to the current month.
- Promotion marker between two consecutive stints at the same company:
  - When the older stint is an `internship` and the newer one is not, it reads
    "↑ Promoted to full-time · <month>" (localized).
  - Otherwise it is a plain connector with no wording.
- Project row (compact):
  - Title, and the period with its duration.
  - Role: the child's role text.
  - Team size.
  - **One result line:** the localized `caseStudy.result`, shown in full (no ellipsis). It is omitted when there is
    no case study.
  - Up to 5 tech chips, then "+N".
  - "Case study →".
  - The long `summary` sits behind a per-row disclosure ("Show description"), collapsed by default but kept in the
    DOM.
- Collapsed parent summary chip: "5 projects · 2 positions · Intern → Engineer". The arrow part appears only when a
  promotion marker exists. Schools show "3 projects · GPA 7.66/10".
- Mini Gantt (A2, B8):
  - Shown for companies with at least 2 children.
  - The axis is labelled by month.
  - The stint lane comes first: one segment per stint, coloured on the koi gradient, with the promotion tick on it.
  - Below it, one 10 px bar per project, aligned to the same axis.
  - Hovering or focusing a project row lights its bar, and the reverse. Clicking a bar scrolls to its row.
  - The Gantt is `role="img"` with a text label summarising stints and project spans; the rows below are the
    accessible source.
  - Under 640 px the project-name labels inside the Gantt are hidden (the bars stay), and nothing scrolls sideways.

### 5.2 Experience tree: visual layer and motion (B6–B10)

- Rail: the straight gradient line and `TracingBeam` are replaced by one slightly wavering SVG ink path.
  - It fills with scroll: a scroll-linked `pathLength`, or a clip on a duplicate path.
  - The fill colour goes from koi orange to teal at its bottom end.
  - Under reduced motion it is fully drawn and static.
- Parent marker: a small vermilion hanko holding the parent's last year in kanji numerals (二〇二六). It is filled
  for the open parent and outlined for collapsed ones, and `aria-hidden`.
  - It stamps once (scale 1.35 → 1, 260 ms) the first time it enters the viewport.
- Open and close of a parent:
  - The panel reveals top-down (`grid-template-rows` plus `clip-path: inset()`), like a scroll unrolling.
  - Opening takes 360 ms and closing 220 ms.
  - Rows rise in with a 40 ms stagger, capped at 6.
  - Reduced motion: instant.
- Cards: washi grain at 4% (reuse `GrainOverlay` or the same noise). On hover or focus-within, a soft orange/teal
  "ink bleed" glow replaces `GlowCard`'s generic glow.
- Role highlight (the role switcher) keeps today's accent ring. It never reorders.
- The vertical chapter label stays the existing `SectionLabel` seal. There is no extra tategaki in the tree.

### 5.3 Project archive `/[locale]/projects` (C11–C15)

- Header:
  - A serif heading.
  - The localized line "N projects · <first year> – <last year>".
  - The existing chapter seal.
- Filter chips: keep today's chips and counts. The active pill slides between chips (motion `layoutId` or a CSS
  transform). `?kind=` sharing stays.
- Layout: the `<table>` becomes year groups.
  - Each group is a `<section aria-labelledby>` with a sticky year: serif digits, plus the kanji year in
    `aria-hidden`.
  - The group holds a list of row buttons.
  - Rows show:
    - title, with a vermilion ★ seal for featured projects;
    - Where: a kind badge, the parent name and, for work projects, the stint title;
    - tech (3 items, then +N);
    - "Case study →" or the links.
  - Filtering animates rows out and in, and the remaining rows move with FLIP (motion `layout`).
  - Below 640 px rows stack.
- Hover preview:
  - Only for `(hover: hover) and (pointer: fine)`.
  - A 220×136 card follows the pointer with a spring. It shows the project's `posterUrl` when set, otherwise a
    gradient card with the title.
  - On keyboard focus it is anchored to the row's right edge.
  - It is never the only way to reach anything, and it is hidden under reduced motion.
- Opening a case study from a row:
  - When `document.startViewTransition` exists and motion is allowed, the row title morphs into the panel title
    (same-document View Transition, a named element on both).
  - Otherwise it opens normally.
  - Progressive enhancement only; no Next experimental flag.

### 5.4 Case study panel: 掛軸 Kakejiku (D16–D19, replaces the right sheet)

- One shared component replaces `CaseStudySheet`, used by `JourneyTree`, `ProjectArchive`, `ProjectsBento` and
  `ProjectCard`.
  - It is a centred Radix Dialog: inset 2.5 vh by 2.5 vw, `max-width` 1320 px, radius 18 px.
  - Mount (表装): a dark frame with a faint gold inner hairline, thin "rod" bands top and bottom, washi grain, and
    two soft ink-wash corners (orange top right, teal bottom left).
- Left spine, 44 px:
  - The chapter label in vertical text: 第一章 経歴 when opened from the tree, 第二章 作品 from the bento or archive.
  - The position "02 / 08" in the current list. Decorative, `aria-hidden`; the position is also in the accessible
    footer.
- Header:
  - A "where" line: parent and stint.
  - The serif title.
  - A meta row: Role · Team · Period with duration · Where (kind).
  - Actions: Demo and Code when present, Copy link, Close.
- **Result banner** first:
  - A gold-bordered band with a faint seigaiha pattern fading in from the right.
  - A vermilion 果 seal (`aria-hidden`).
  - The heading "Result" and the full result text in the serif.
- Three panes (一 Problem, 二 Role, 三 Decisions):
  - Side by side in one bordered "byōbu" strip, full text, no clamp.
- Footer:
  - **All** tech chips, wrapping.
  - Previous and next project buttons with the project names. ← → keys work when focus is not in a text field.
- Fit rule:
  - At viewport ≥ 1024 × 680 the longest seed case study (FlexyBox Phase 2) must fit with no inner overflow.
    The mockup measured 688/688 px at 1366 × 768.
  - Below that size, or narrower than 1024 px, the panel becomes full-screen with one column. Only then does the
    content area scroll, with a thin, low-contrast scrollbar (`scrollbar-width: thin`) and top/bottom fade masks.
- Motion:
  - The mount unrolls top-down (`clip-path`, 450 ms).
  - The result band rises at 150 ms, the panes stagger 60 ms from 220 ms, and the seal stamps at 420 ms (260 ms).
    Everything is readable by 500 ms.
  - Closing is a 180 ms fade and scale-down.
  - Reduced motion: a fade only.
- Deep link:
  - `?case=<projectId>` opens the panel on load on `/` and `/[locale]/projects`. Opening and closing update the URL
    with `history.replaceState`, so there are no history spam entries.
  - "Copy link" copies that URL and confirms with a toast.
- Previous and next follow the order of the list the panel was opened from: tree order, bento order, or the
  archive's current filter.
- Focus: trapped; Esc closes; focus returns to the opener (as today). The dialog title is the project title.

### 5.5 Side navigation: 墨の糸 Ink thread (E20, replaces the SideRail list styling)

- Each item shows:
  - a kanji chapter numeral (序 一 二 三 四 五 終) in the serif, `aria-hidden`;
  - the label in small caps (unchanged text);
  - a 1 px progress hairline under the label that fills (`scaleX`) with that chapter's reading progress.
- One thin SVG path runs through the numeral column, with a slight sway between items. A duplicate accent path is
  revealed with `clip-path` from the top to the reader's position. The position is interpolated inside the active
  chapter by its progress.
  - An "ink drop" (a 9 px dot with a glow) sits at the leading edge.
  - The colour is the role accent until 第五章 昇龍 and teal from there on. This is the same trigger that turns the
    top koi into a dragon (`ScrollProgressKoi`).
- Mechanics:
  - The path is built from item offsets in a `ResizeObserver` (all reads, then writes).
  - Scroll updates write CSS variables and styles in `requestAnimationFrame`. React re-renders only when the
    active chapter changes (`useActiveSection`, unchanged).
- Active item: text colour, weight and numeral colour change; `aria-current` is unchanged.
- "All projects" is a dashed spur off the thread with ↗. It is not part of the progress. On `/projects` the spur is
  inked and `aria-current="page"`.
- A peek card appears on hover and focus-visible: the chapter kanji plus a one-line localized hint (new
  `nav.peek.<id>` keys). It is decorative (`aria-hidden`), because the link text already names the section.
- Reduced motion: no transitions, but the fill still reflects the position.
- The budget applies: this is plain DOM and SVG, with no motion import in the rail.

## 6. Verification

- Unit tests:
  - `formatDuration` in all locales, including edge cases (same month, open-ended).
  - Stint grouping and order.
  - The promotion-marker rule.
  - Gantt geometry: segment and bar positions as month fractions.
  - Archive year grouping.
  - The deep-link parser (unknown id is ignored).
  - Previous/next order per context.
- E2E (Playwright + axe, light and dark):
  - The tree shows stints with their projects under them; Gantt hover/focus sync.
  - Expand and collapse by keyboard; hash deep links still open the right parent.
  - Archive filtering keeps focus and URL.
  - Panel:
    - opens from the tree, bento and archive;
    - `?case=` opens it on load;
    - ←/→ moves between projects;
    - Esc returns focus to the opener;
    - **at 1366 × 768 every seed case study has `scrollHeight ≤ clientHeight` in the panel content.**
  - Side navigation: `aria-current` follows the scroll, and the fill reaches the active item.
  - Reduced motion: no animation, content complete.
- Budgets: `scripts/measure-initial-js.mjs` stays ≤ 200 KB on both routes. Lighthouse CLS ≤ 0.1 on `/` and
  `/[locale]/projects`.

## 7. Left to the builder

- Component split and file names.
- Exact easing curves within the motion tokens.
- The SVG sway shape.
- Light-mode token values.
- Peek-card copy within the stated purpose.
- Whether the Gantt and the archive hover preview load after first paint to protect the budget.
- How the panel's View Transition name is wired.
- Stack-ordering details for the hanko and the rail.

## 8. Owner decisions recorded (2026-10-30)

- Emaki direction, parts A–E.
- Side navigation: A, 墨の糸 Ink thread.
- Case study panel: C's Japanese character combined with A's completeness (掛軸 hybrid), with no inner scrollbar
  wherever it can fit.
- The 2026-10-27 migration and merge wait until this redesign lands. One rollout.
