# Experience tree and all-projects page — design

Status: draft for owner approval, 2026-10-27. Mockups: `Portfolio/.superpowers/brainstorm/504-1793030135/content/` (`experience-tree.html` option A, `all-projects.html` option A).

## 1. Intent

The portfolio has to stay readable as the owner adds companies and projects. Recruiters should see the whole
journey in seconds (schools and companies, with the projects done at each) and find every project the owner
has worked on, while the home page keeps the current three-card Projects look for the owner's best work.

Today the "projects" under SKG in Experience are five `experiences` rows sharing a `parentCompany`, while the
`projects` table holds three university projects with no link to any school or company. The same kind of thing
lives in two places and the Projects section cannot show work projects.

## 2. Goals, non-goals, anti-goals

Goals
- One project list, entered once in the admin, each project attached to a company stint, a school, or nothing
  (personal), with its own role, period, kind and a star.
- Experience: a vertical, LinkedIn-style tree. Parents are companies and schools; children are their projects.
  The newest parent is expanded; older parents are collapsed and show a summary chip ("5 projects").
- Company parent header: company name and location, then its position lines (e.g. "Software Engineer, acting
  PM / Tech Lead · Oct 2025 – Sep 2026", "Intern · Aug – Oct 2025"), now data instead of the hard-coded
  `SKG_LINES`.
- Projects on the home page: the existing bento of three cards shows the starred projects (max 3, admin
  drag-to-order; if fewer than 3 are starred, fill with the newest published projects), plus a link
  "View all N projects →".
- New page `/[locale]/projects`: an archive table (year, project, where, role, tech, links) with filter chips
  All / Work / University / Personal; on narrow screens rows become stacked items. Clicking a project opens the
  existing case study sheet.
- Role switcher (Full-stack / Tech Lead / PM): never reorders; it highlights the projects relevant to the
  selected role in the tree and the archive.

Non-goals
- No separate `organizations` table (approach 2, rejected).
- Personal projects do not appear in the Experience tree (owner choice); they appear in Projects only.
- No new content in this change beyond moving the existing five SKG rows; adding more projects is the next
  piece of work (part 3 of the overall request).

Anti-goals
- Losing or altering any published text, case study, skill link or version history during the migration.
- A tree that reorders or hides history by role (owner chose highlight only).
- Layout shift, motion that ignores reduced-motion, or controls that are not keyboard operable.

## 3. Constraints

- Next.js 16 Cache Components; content is read through `src/lib/data/get-content.ts` under the `content` tag;
  admin saves call `updateTag('content')`.
- Hosted Supabase is shared by preview and production: the migration is additive where possible, ships rollback
  SQL, is applied only after owner approval of the concrete SQL (ADR-0012), and its file is named after the
  hosted version.
- RLS model unchanged: visitors read published rows; admin writes; read-only reviewer reads (ADR-0013). Any
  new column is covered by the existing table policies; new tables are not introduced.
- Three locales (EN/JA/VI) through the existing i18n text type; JA/VI fall back to EN.
- CI gates: unit, e2e, a11y (axe), Lighthouse a11y/SEO/CLS, bundle budget ≤200 KB initial JS; Koi design tokens.

## 4. Approaches considered

1. **Extend the existing tables (chosen).** `experiences` become position stints at a company (parent nodes
   together with `education`). `projects` gain a parent link, kind, star and star order. One migration moves the
   five SKG rows into `projects`. Smallest change; admin, RLS and reviewer access keep working.
2. Separate `organizations` + positions + projects. Cleanest model, roughly twice the work (tables, policies,
   admin screens, RLS tests) with no visible difference for visitors. Rejected by the owner.
3. Merge at display time only. Rejected: the owner wants each project entered once.

## 5. Decisions

### 5.1 Data model
- `projects` new columns:
  - `experience_id text null references experiences(id) on delete restrict` — the company stint the project
    belongs to.
  - `education_id text null references education(id) on delete restrict` — the school. Deleting a stint or
    school that still has projects is refused; the admin explains which projects to move first.
  - check: at most one of the two is set.
  - `kind text not null check (kind in ('work','university','personal'))`; must agree with the link
    (`work` ⇔ experience_id set, `university` ⇔ education_id set, `personal` ⇔ both null).
  - `featured boolean not null default false`, `featured_order int null`; at most 3 featured rows
    (enforced in the server action and by a unit-tested validation; a DB trigger is the builder's call).
  - `roles text[] not null default '{}'` — role keys (`fullstack`, `techlead`, `pm`) this project showcases,
    used only for highlighting. *(Claude's call: replaces reordering by `roles.experience_order`.)*
  - `team_size`, `links` (from experiences) — projects already have `repo_urls`/`demo_url`; `team_size text null`
    is added so the five migrated rows keep theirs; their `links` map to `repo_urls`/`demo_url` where they fit,
    the rest are kept in a new `links jsonb not null default '[]'`.
- `experiences` keep their table and columns; meaning becomes "a position stint". Each company appears as one
  parent; its header lists its stints. Parent grouping key: `parent_company` when set, otherwise `company`.
- `roles.experience_order` stays (other screens use it) but no longer drives this section; health checks that
  reference it stay valid.
- Skills: `skill_links` already support `project_id`; links of the five migrated experience rows are re-pointed to
  the new project ids.

### 5.2 Migration (hosted data)
- Stints: the existing row `skg-intern` is converted **in place** into the internship stint (company SKG Software
  (Splus), position from `experience.skgIntern`, Aug–Oct 2025), so its version history continues; a new row
  `skg-engineer` is the Software Engineer stint (Oct 2025 – Sep 2026, title from `experience.skgEngineer`). Stint
  summaries are optional (empty i18n text allowed for stints; the header shows a summary only when present).
  FPT Japan stays as is (its summary and tech stay visible in its parent header).
- Projects moved from experiences: `skg-ai-agent`, `skg-flexybox-p2`, `skg-coa`, `skg-flexybox-p1` keep their ids
  in `projects`; the TONGUE-AI & Driver MS content (old `skg-intern`) becomes project `tongue-ai-driver-ms`. Each
  copies title (from `company`), role (from `position`), period, summary, case study, tech, team size, links,
  published, sort index; `kind='work'`. Stint assignment by dates (owner-confirmed): `tongue-ai-driver-ms` and
  `skg-flexybox-p1` → `skg-intern` (FlexyBox Phase 1 was led as acting PM during the internship);
  `skg-coa`, `skg-flexybox-p2`, `skg-ai-agent` → `skg-engineer`. Re-point their `skill_links`; delete the four
  moved experience rows (the converted `skg-intern` row stays).
- Anchors: tree parents `#exp-<group key slug>` (e.g. `#exp-skg-software`), tree children `#tree-<project id>`,
  bento cards keep `#proj-<id>` (no duplicate DOM ids when a starred project is also in the tree). The migration
  rewrites `why_cards.evidence_link` values that point at moved rows (`#exp-skg-flexybox-p2` →
  `#tree-skg-flexybox-p2`, etc.); the evidence-link regex, `health.ts` broken-evidence check, Skills evidence
  anchors and `HighlightProvider` accept `#tree-` targets; a link to a project not on the home page falls back to
  `/[locale]/projects#row-<id>`.
- `roles.experience_order` is rewritten to stint ids; `/[locale]/quick` reads work projects from `projects`
  (newest first) so the recruiter quick view keeps listing the SKG projects.
- Initial `roles` highlight tags derived from the existing position text: contains "PM" → `pm`; "Tech Lead" →
  `techlead`; "Full-stack", "Developer" or "front-end" → `fullstack`; the owner adjusts in the admin.
- University projects (`siteplus`, `zodiacgems`, `meet-my-lecturer`): `kind='university'`,
  `education_id='fpt-university'`. Other existing projects: `kind='personal'`.
- Featured after migration (owner choice): `siteplus`, `zodiacgems`, `meet-my-lecturer` starred in that order, so the
  home page does not change on deploy.
- Rollback SQL restores the five experience rows and their skill links from the inserted projects and drops the
  new columns. Version history keeps every old row (triggers already record deletes).
- The same change is reflected in `src/content/seed.json`, `columns.ts`, mappers and `schema.sql`.

### 5.3 Experience tree (UI)
- Order: parents by most recent end date (open-ended first); children by start date, newest first.
- Newest parent expanded on load; others collapsed with a chip ("5 projects" / "internship"). State is not
  persisted; a URL hash `#exp-<id>` expands and scrolls to that parent.
- Parent row is a disclosure button (`aria-expanded`, `aria-controls`); Enter/Space toggle; focus stays on the
  button. Children list animates height/opacity (motion) and renders instantly with reduced motion.
- Visual: vertical rail with the Koi orange-to-teal gradient, parent dots, dashed child connectors (mockup A);
  child card keeps today's content (title, period, role, summary, tech chips, team size, links) and opens the
  existing `CaseStudySheet` when a case study exists. No published text disappears from the page.
- Role highlight: children whose `roles` include the selected role get the accent ring; others stay normal.
- A parent with no children (FPT Japan) shows its stint lines only.

### 5.4 Projects section and archive page
- Home bento: `ProjectsBento` unchanged visually; data = featured (ordered) or fallback newest three; adds the
  "View all N projects →" link (localized) to `/[locale]/projects`.
- `/[locale]/projects`: server page reading the same cached content; heading, intro line, filter chips
  (client state + `?kind=` query for shareable links), table with columns Year · Project · Where · Role · Tech ·
  Links; star marker for featured; row click or Enter opens the case study sheet; responsive stacked layout
  < 640 px. Metadata title/description per locale, canonical + hreflang, included in `sitemap.ts`, linked from
  the ⌘K palette and the header nav.

### 5.5 Admin
- Projects form: "Where" select (company stints grouped by company, schools, "Personal"), kind derived from it
  (shown read-only), role highlight checkboxes, team size, links.
- List view: star toggle per row; when 3 are starred, the 4th toggle is refused with an inline message naming
  the limit and how to free a slot; starred rows can be drag-ordered in a "Featured" strip at the top.
- Experiences screen is relabelled "Positions" (stints); the parent header preview shows how the company will
  look in the tree.
- Reviewer (read-only) sees the same screens without write controls (existing provider).

### 5.6 Verification
- Unit: schema/mappers round-trip; tree grouping/ordering; featured fallback and max-3 rule; kind/link
  consistency; migration SQL shape (as existing db-schema tests do).
- Disposable Supabase CI: migration replay + RLS for new columns (visitor sees only published; reviewer reads;
  writes admin-only).
- E2E: tree expand/collapse by mouse and keyboard, hash deep link, archive filter + query, case study opens,
  axe on home and `/projects` in light/dark, reduced motion.
- Lighthouse: `/[locale]/projects` added to the audited routes; CLS ≤ 0.1.

## 6. Left to the builder
Component split and file names, exact animation curves within the existing motion tokens, table styling details,
the DB trigger vs action-only enforcement of max 3, empty-state copy, admin drag-and-drop implementation (reuse
the existing reorder pattern).

## 7. Owner decisions recorded (2026-10-26/27)
- One shared project list; extend existing tables (approach 1).
- Experience tree layout A (vertical rail, newest expanded, older collapsed).
- All-projects layout A (separate `/projects` archive page).
- Personal projects only in Projects, not in the tree.
- Company header shows name and position stints.
- Role switcher highlights, never reorders.
- Featured: max 3, drag to order, fallback newest; migration stars the current three.
- FlexyBox Phase 1 belongs to the internship stint.
