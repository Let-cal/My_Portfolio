# Experience Tree and All-Projects Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One project list attached to company stints or schools drives a collapsible Experience tree, a starred top-3 bento and a new `/[locale]/projects` archive page.

**Architecture:** Extend `projects` (parent link, kind, star, role tags, team size, links) and repurpose `experiences` as position stints; a reviewed, reversible migration moves the five SKG rows. Pure selectors (`src/lib/journey.ts`, `src/lib/featured.ts`) build view-models that the server sections hand to small client components. Admin gets the new fields, a max-3 star rule and a featured strip.

**Tech Stack:** Next.js 16 (Cache Components, next-intl), React 19, motion, Zod, Supabase Postgres + RLS, Vitest + Testing Library, Playwright + axe, Lighthouse CI.

**Spec:** `docs/superpowers/specs/2026-10-27-experience-tree-and-projects-design.md`

## Global Constraints

- Branch `feat/experience-tree-projects`; `npm run verify` before every push; no Claude attribution lines in commits/PRs.
- Hosted DB: apply the migration only after the owner approves the concrete SQL in chat; then rename the file to the version the hosted history records (ADR-0012); never `supabase db push` without approval.
- Merge to `main` only with owner approval, bound to the reviewed head SHA.
- Anchors: tree parent `#exp-<groupKeySlug>` (SKG → `#exp-skg-software`), tree child `#tree-<projectId>`, bento card `#proj-<projectId>`, archive row `row-<projectId>`.
- Moved ids: `skg-ai-agent`, `skg-flexybox-p2`, `skg-coa`, `skg-flexybox-p1` (same ids in `projects`); old `skg-intern` content → project `tongue-ai-driver-ms`; experience `skg-intern` becomes the internship stint (Aug–Oct 2025); new stint `skg-engineer` (Oct 2025 – Sep 2026).
- Stint assignment: `tongue-ai-driver-ms`, `skg-flexybox-p1` → `skg-intern`; `skg-coa`, `skg-flexybox-p2`, `skg-ai-agent` → `skg-engineer`.
- University projects (`siteplus`, `zodiacgems`, `meet-my-lecturer`) → `kind='university'`, `education_id='fpt-university'`, starred in that order (featured_order 1,2,3).
- `kind` ⇔ link: `work` ⇔ `experience_id` set, `university` ⇔ `education_id` set, `personal` ⇔ both null; FKs `on delete restrict`.
- Featured max 3; fewer than 3 starred → fill with newest published (by `start` desc).
- Role switcher highlights (projects whose `roles` contain the role); never reorders.
- Initial `roles` from position text: contains "PM" → `pm`; "Tech Lead" → `techlead`; "Full-stack" | "Developer" | "front-end" (case-insensitive) → `fullstack`.
- No published text disappears: tree child cards keep title, period, role, summary, tech, team size, links.
- Three locales EN/JA/VI for every new string (messages/*.json); reduced motion respected; keyboard operable.

## Review Focus

1. Locale fallback for new i18n fields (JA/VI empty) → shows EN, never an empty card. Test in Task 3 (`journey falls back to en`).
2. A project whose stint is unpublished → it must not appear in the tree but still appears in `/projects` only if itself published. Test in Task 3.
3. More than 3 starred rows already in data (e.g. edited via SQL) → bento shows the first 3 by `featuredOrder`, health reports an error. Tests in Task 3 and Task 7.
4. Deep link to a collapsed parent (`#exp-fpt-university`) and to a child inside it (`#tree-siteplus`) → parent expands and scrolls into view. E2E in Task 4.
5. `?kind=` with an unknown value on `/projects` → treated as "all", no crash. Test in Task 6.

---

### Task 1: Content schema, columns and mappers

**Files:**
- Modify: `src/content/schema.ts` (projectSchema, experienceSchema summary, whyCard evidenceLink regex)
- Modify: `src/lib/data/columns.ts:84-102` (projects), `src/lib/data/mappers.ts:250-289` (rowToProject/projectToRow)
- Modify: `src/lib/data/schema-sql.ts` (render new columns + checks), `supabase/schema.sql` (regenerated)
- Test: `tests/unit/mappers.test.ts`, `tests/unit/project-schema.test.ts` (new), `tests/unit/db-schema.test.ts`

**Interfaces:**
- Produces: `Project` gains `experienceId: string | null`, `educationId: string | null`, `kind: "work" | "university" | "personal"`, `featured: boolean`, `featuredOrder: number | null`, `roles: RoleKey[]`, `teamSize: string | null`, `links: Link[]`. `projectSchema` is a `superRefine`d object enforcing the kind ⇔ link rule (message: `"kind must match where the project belongs"`). `ProjectRow` gains `experience_id, education_id, kind, featured, featured_order, roles, team_size, links`. Evidence regex: `/^#(exp|proj|tree)-[a-z0-9]+(-[a-z0-9]+)*$/`. Experience `summary` allows empty strings (i18n with `en` possibly `""`).

- [ ] **Step 1: Failing tests.** `project-schema.test.ts`: `rejects work without experienceId`, `rejects university with experienceId`, `accepts personal with no links`, `roles only accept role keys`. `mappers.test.ts`: `project round-trips the new fields` (row → project → row deep-equals). `why.test.tsx`/schema: `#tree-skg-coa` is a valid evidence link.
- [ ] **Step 2:** `npx vitest run tests/unit/project-schema.test.ts tests/unit/mappers.test.ts` → FAIL (fields missing).
- [ ] **Step 3:** Implement the schema, columns (`experience_id text references public.experiences (id) on delete restrict`, `education_id text references public.education (id) on delete restrict`, `kind text not null default 'personal' check (kind in ('work','university','personal'))`, `featured boolean not null default false`, `featured_order int`, `roles text[] not null default '{}'`, `team_size text`, `links jsonb not null default '[]'`, table check `projects_kind_matches_link`), mappers, schema-sql; regenerate `supabase/schema.sql` with the repo's existing script.
- [ ] **Step 4:** Same vitest run + `npx vitest run tests/unit/db-schema.test.ts` → PASS.
- [ ] **Step 5:** Commit `feat(data): projects belong to a stint, a school or nobody; stars and role tags`.

### Task 2: Migration, rollback and seed

**Files:**
- Create: `supabase/migrations/<cli timestamp>_experience_tree_projects.sql`, `docs/experience-tree-rollback.sql`
- Modify: `src/content/seed.json`, `scripts/ci/*` only if the backend checks assert row counts
- Test: `tests/unit/db-schema.test.ts` (migration shape), `tests/unit/seed-migration.test.ts` (new)

**Interfaces:**
- Consumes: Task 1 columns.
- Produces: data state described in Global Constraints; `why_cards.evidence_link` rewritten `#exp-<moved id>` → `#tree-<new project id>`; `roles.experience_order` = stint ids per role (`skg-engineer`, `skg-intern`, `fpt-japan` order).

- [ ] **Step 1: Failing tests.** `seed-migration.test.ts` on the updated seed: `5 work projects attached to SKG stints with the owner's stint mapping`, `3 starred university projects in order siteplus, zodiacgems, meet-my-lecturer`, `no why card points at a missing anchor`, `every moved project keeps its summary, case study and skill links` (compare with a frozen copy of the old seed rows in the test). `db-schema.test.ts`: `migration adds columns and check, moves five rows, rewrites why cards`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Write the migration in one transaction: add columns + check; insert the two stints logic (convert `skg-intern` in place, insert `skg-engineer` with titles from `messages/*.json` `experience.skgIntern/skgEngineer`); insert projects from the four experience rows + `tongue-ai-driver-ms` (copy fields, `links` → `repo_urls`/`demo_url` when the label is Code/Demo, else `links`); update `skill_links` (`experience_id` → `project_id`); set kinds/education/featured/roles (rule in Global Constraints); rewrite why_cards and roles.experience_order; delete the four moved experience rows. Rollback file reverses it from the projects rows. Mirror the result in `seed.json`.
- [ ] **Step 4:** Run tests → PASS; `npm run db:verify`-style local check is CI-only (no Docker here): rely on the disposable-Supabase job, which replays every migration.
- [ ] **Step 5:** Commit `feat(db): move SKG projects into projects and add the internship and engineer stints`.

### Task 3: Pure selectors — journey tree and featured projects

**Files:**
- Create: `src/lib/journey.ts`, `src/lib/featured.ts`
- Test: `tests/unit/journey.test.ts`, `tests/unit/featured.test.ts`

**Interfaces:**
- Produces:
  - `type JourneyChild = { id: string; anchor: string; title: string; role: string; period: string; summary: string; tech: string[]; teamSize: string | null; links: Link[]; caseStudy: CaseStudyView | null; roles: RoleKey[] }`
  - `type JourneyParent = { key: string; anchor: string; kind: "company" | "school"; name: string; location: string | null; period: string; lines: { title: string; period: string }[]; summary: string | null; tech: string[]; children: JourneyChild[]; chip: { count: number } | { label: "internship" } | null }`
  - `buildJourney(content: Content, locale: Locale, t: (key: string) => string): JourneyParent[]` — parents by latest end (open-ended first), children by start desc, only published stints/education/projects, i18n fallback to EN.
  - `featuredProjects(projects: Project[], limit = 3): Project[]` and `starRefusal(projects: Project[], id: string): string | null` (Vietnamese admin message when a 4th star is attempted: `"Đã có 3 dự án nổi bật. Bỏ sao một dự án khác trước."`).
- [ ] **Step 1: Failing tests** with seed fixtures: `SKG parent first, expanded data has 5 children newest first`, `FPT University parent has 3 university children`, `FPT Japan has no children and keeps its summary`, `personal projects never in the journey`, `journey falls back to en`, `unpublished stint hides its projects`, `featured uses featuredOrder then fills with newest`, `more than 3 starred → first 3 by order`, `starRefusal blocks the 4th`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: journey tree and featured project selectors`.

### Task 4: Experience tree UI

**Files:**
- Modify: `src/components/sections/Experience.tsx` (use `buildJourney`; drop `SKG_LINES`), `src/components/sections/experience/Timeline.tsx` → split into `JourneyTree.tsx` (client) + reuse `CaseStudySheet`
- Modify: `src/components/site/HighlightProvider.tsx`, `src/components/sections/Skills.tsx` (accept `#tree-` / `#exp-<groupKey>`)
- Modify: `messages/{en,ja,vi}.json` (`experience.projectsCount`, `experience.internshipChip`, expand/collapse labels)
- Test: `tests/unit/timeline.test.tsx` (rewrite as `journey-tree.test.tsx`), `tests/e2e/experience-tree.spec.ts` (new)

**Interfaces:**
- Consumes: `JourneyParent[]` (Task 3).
- Produces: DOM ids `exp-<key>` on parents, `tree-<id>` on children; parent disclosure buttons with `aria-expanded`/`aria-controls`.

- [ ] **Step 1: Failing tests.** Unit: `newest parent expanded, others collapsed with chip`, `Enter and Space toggle a parent`, `role highlight marks children with the role, order unchanged`, `child card shows summary, tech, links`, `case study button opens the sheet`. E2E: `hash #tree-siteplus expands FPT University and scrolls to the card`, `reduced motion renders without animation`, axe passes on `/en#experience` light and dark.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement per spec §5.3 (rail gradient, dots, dashed connectors; motion height/opacity with `usePrefersReducedMotion`). **Step 4:** Run unit + `npx playwright test tests/e2e/experience-tree.spec.ts` → PASS.
- [ ] **Step 5:** Commit `feat(site): experience as a collapsible journey tree`.

### Task 5: Projects section — starred bento and "View all"

**Files:**
- Modify: `src/components/sections/Projects.tsx`, `src/components/sections/projects/ProjectsBento.tsx`, `messages/*.json` (`projects.viewAll` with `{count}`)
- Test: `tests/unit/project-card.test.tsx`, `tests/unit/projects-section.test.tsx` (new)

- [ ] **Step 1: Failing tests:** `bento shows featuredProjects in order`, `View all link points to /<locale>/projects with the total count`, `cards keep #proj-<id>`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(site): starred projects on the home page and a link to all projects`.

### Task 6: `/[locale]/projects` archive page

**Files:**
- Create: `src/app/[locale]/projects/page.tsx` (server), `src/components/sections/projects/ProjectArchive.tsx` (client table + filters)
- Modify: `src/app/sitemap.ts`, command palette items (`src/components/site/CommandPalette*.tsx` or its items source), header/side nav (`src/components/site/sections.ts` or PillNav), `messages/*.json` (`archive.*`)
- Modify: Lighthouse route list (`scripts/performance-budgets.mjs` / CI config) to audit `/en/projects`
- Test: `tests/unit/project-archive.test.tsx`, `tests/e2e/projects-archive.spec.ts`

**Interfaces:**
- Produces: `archiveRows(content: Content, locale: Locale): ArchiveRow[]` with `{ id, year, title, where, whereKind, role, tech, demoUrl, repoUrls, featured, caseStudy }`, `parseKind(q: string | null): "all" | "work" | "university" | "personal"`.

- [ ] **Step 1: Failing tests:** `rows sorted by start desc with where = company/school/Personal`, `filter chips update ?kind and the visible rows`, `parseKind('bogus') === 'all'`, `row Enter opens the case study`, `rows whose roles include the selected role get data-highlight, order unchanged`, `metadata has canonical and hreflang for en/ja/vi`, `sitemap lists /en/projects /ja/projects /vi/projects`. E2E: filter + reload keeps the filter; axe light/dark; mobile 375px shows stacked rows without horizontal scroll.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(site): all-projects archive page with filters`.

### Task 7: Quick view, roles order and health checks

**Files:**
- Modify: `src/lib/quick.ts` (work projects from `projects`, newest first), `src/lib/roles.ts`, `src/lib/admin/health.ts` (visible anchors include `#tree-`/`#exp-<groupKey>`; error when >3 featured; warning when a project's kind and link disagree), `src/lib/admin/impact.ts`
- Test: `tests/unit/quick.test.ts`, `tests/unit/admin-health.test.ts`

- [ ] **Step 1: Failing tests:** `quick lists the five SKG projects newest first`, `health: why card #tree-skg-coa is valid`, `health: 4 featured → error`, `health: no stale-order warning after migration`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat: quick view and health checks follow the new project model`.

### Task 8: Admin

**Files:**
- Modify: `src/lib/admin/resources.ts` (projects fields/sections: "Thuộc về" select of stints grouped by company + schools + "Cá nhân", read-only kind, `roles` checkboxes, `teamSize`, `links`; experiences label "Vị trí làm việc"), `src/components/admin/ResourceTable.tsx` (star toggle, featured strip drag-order reusing the reorder pattern), `src/app/admin/actions.ts` (`toggleFeatured(id: string): Promise<ActionResult>` and `reorderFeatured(ids: string[]): Promise<ActionResult>`, both `requireAdmin()`; delete of a stint/school with projects returns the message `"Còn N dự án thuộc mục này. Chuyển các dự án sang mục khác trước khi xóa."`)
- Test: `tests/unit/admin-featured.test.ts(x)`, `tests/unit/admin-actions.test.ts` (reviewer FORBIDDEN for the two new actions), `tests/unit/admin-read-only.test.tsx` (no star toggles for reviewer)

- [ ] **Step 1: Failing tests:** `4th star refused with the message`, `reorderFeatured writes featured_order 1..n`, `reviewer gets FORBIDDEN before any DB call`, `deleting skg-engineer with projects is refused with the count`, `Where select lists SKG stints, FPT University and Cá nhân`, `positions screen shows a preview of the company header (name + stint lines) built with buildJourney`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(admin): where a project belongs, role tags and up to three stars`.

### Task 9: Verify, review, rollout (owner gates)

Runbook (preflight SQL, apply, verification, preview and production checks, rollback order): [docs/experience-tree-rollout.md](../../experience-tree-rollout.md).

- [ ] **Step 1:** `npm run verify` → exit 0; push; open PR with spec/plan links; Auto-fix on; disposable-Supabase job replays the migration and RLS checks (visitor sees only published projects incl. new columns; reviewer reads; writes admin-only).
- [ ] **Step 2:** Whole-branch review (fresh reviewer, plus ai-generated-code-auditor for the migration/RLS/admin actions); one fix pass.
- [ ] **Step 3 (gate):** Show the owner the exact migration SQL + rollback; on approval apply via MCP `apply_migration`, rename the file to the hosted version, verify read-only (column set, check constraint, 5 work + 3 university projects, why cards, advisors).
- [ ] **Step 4:** Preview check on the PR deployment (en/ja/vi, light/dark, mobile): tree, deep links, bento, `/projects`, admin star flow (owner signs in; reviewer account for read-only).
- [ ] **Step 5 (gate):** Owner approves merge → SHA-bound merge → production verification (pages 200, tree renders, `/en/projects` 200, quick view lists SKG projects).
