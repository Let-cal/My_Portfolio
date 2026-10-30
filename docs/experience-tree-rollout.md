# Experience tree: deployment and rollback runbook

Rollout of `supabase/migrations/<version>_experience_tree_projects.sql` (spec: [2026-10-27 experience tree and projects](superpowers/specs/2026-10-27-experience-tree-and-projects-design.md), plan Task 9). Rollback SQL: [experience-tree-rollback.sql](experience-tree-rollback.sql).

Preview deployments and production share one hosted Supabase database ([ADR-0012](adr/0012-hosted-migrations-through-reviewed-sql.md)). The migration therefore changes what production reads the moment it runs. The production app (pre-merge) still reads the old shape until the merge deploys, so the window between steps 4 and 6 is kept short.

Moved experience ids: `skg-ai-agent`, `skg-flexybox-p2`, `skg-coa`, `skg-flexybox-p1` (become projects and are deleted as experiences), and `skg-intern` (its content becomes project `tongue-ai-driver-ms`; the row stays as the internship stint).

## 1. Preflight (read-only, hosted DB)

Run each query with MCP `execute_sql` (read-only) and keep the output in the PR.

```sql
-- a. The five moved experiences exist, with their parent company.
select id, company, parent_company, published, sort_index
from public.experiences
where id in ('skg-ai-agent', 'skg-flexybox-p2', 'skg-coa', 'skg-flexybox-p1', 'skg-intern')
order by id;
-- expect 5 rows; skg-engineer and tongue-ai-driver-ms must not exist yet:
select (select count(*) from public.experiences where id = 'skg-engineer') as engineer,
       (select count(*) from public.projects where id = 'tongue-ai-driver-ms') as tongue;

-- b. Their link labels ("Code" -> repo_urls, first "Demo" -> demo_url, the rest stay links).
select e.id, l ->> 'label' as label, l ->> 'url' as url
from public.experiences e, jsonb_array_elements(e.links) with ordinality as x(l, n)
where e.id in ('skg-ai-agent', 'skg-flexybox-p2', 'skg-coa', 'skg-flexybox-p1', 'skg-intern')
order by e.id, n;

-- c. The school the university projects attach to.
select id, school from public.education where id = 'fpt-university';

-- d. Why-card evidence links the migration rewrites (#exp-<moved id> -> #tree-<project id>).
select id, evidence_link from public.why_cards
where evidence_link in ('#exp-skg-ai-agent', '#exp-skg-flexybox-p2', '#exp-skg-coa',
                        '#exp-skg-flexybox-p1', '#exp-skg-intern');

-- e. Counts and the current maximum project sort_index (moved projects are numbered after it).
select (select count(*) from public.projects) as projects,
       (select count(*) from public.experiences) as experiences,
       (select count(*) from public.skill_links) as skill_links,
       (select max(sort_index) from public.projects) as max_project_sort_index;
```

Stop if (a) does not return 5 rows, (c) returns nothing, or `skg-engineer` / `tongue-ai-driver-ms` already exist.

## 2. Owner approval (gate)

- Show the owner the exact migration SQL and the rollback file, plus the preflight output.
- The migration adds two private tables:
  - `private.experience_tree_backup`: the pre-migration rows the rollback reads. It is dropped in a follow-up migration once the rollout is accepted (and by the rollback).
  - `private.restore_barriers`: permanent. It makes version restore refuse versions of the five moved experience rows (the content now lives in projects).
- After applying, rename the migration file to the version the hosted history records (ADR-0012) and commit that rename on the PR branch.

## 3. Freeze admin edits

From the start of step 4 until step 6 is verified, nobody edits content in the production admin (it runs the old app against the new schema). The owner confirms the freeze in the PR.

## 4. Apply and verify (hosted DB)

Apply with MCP `apply_migration` (one transaction, name `experience_tree_projects`). Then, read-only:

```sql
-- New project columns and the kind/link rule.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'projects'
  and column_name in ('experience_id', 'education_id', 'kind', 'featured', 'featured_order', 'roles', 'team_size', 'links')
order by column_name;
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.projects'::regclass and conname = 'projects_kind_matches_link';

-- 5 work + 3 university projects, 3 stars on the university projects.
select kind, count(*), count(*) filter (where featured) as starred
from public.projects group by kind order by kind;
select id, kind, experience_id, education_id, featured_order, roles
from public.projects where kind <> 'personal' order by kind, sort_index;

-- Stints: skg-engineer (2025-10 – 2026-09) and skg-intern (2025-08 – 2025-10), no moved rows left.
select id, company, parent_company, start_month, end_month, employment_type
from public.experiences order by start_month desc;

-- Why cards and role order.
select id, evidence_link from public.why_cards order by id;
select key, experience_order from public.roles order by key;

-- Version restore: still security invoker, callable by authenticated only (admin check inside).
select p.prosecdef as security_definer, p.proconfig
from pg_proc p where p.oid = 'public.admin_restore_version(bigint)'::regprocedure;
select grantee, privilege_type from information_schema.routine_privileges
where routine_schema = 'public' and routine_name = 'admin_restore_version';
select table_name, item_key from private.restore_barriers order by item_key;

-- Migration recorded (note the version for the file rename and for a rollback).
select version, name from supabase_migrations.schema_migrations
where name like '%experience_tree%';
```

Expect `security_definer = false`, execute granted to `authenticated` (not `anon`/`public`), five barriers. Run `get_advisors` (security and performance) and compare with the last recorded run: no new findings.

## 5. Preview check

The PR preview was rendered before the migration and is cached on it: redeploy the preview first. Then check (en, ja, vi; light and dark; one mobile width):

- Tree: newest parent (SKG) expanded, older ones collapsed with a chip; deep links `#exp-fpt-university`, `#tree-siteplus`; a skill evidence link into a collapsed parent, both with reduced motion and with Motion on (Lenis).
- Bento shows the 3 starred projects; "View all" leads to `/en/projects`, `/ja/projects`, `/vi/projects` (filters, `?kind=`, `#row-` links).
- Quick view lists the SKG projects.
- Admin (owner): project stars (a 4th is refused), "Thuộc về" (where), role tags; preview links land on the item.
- Reviewer account: read-only everywhere.
- Version history: restoring an old version of a moved experience is refused with the "restore that project instead" message.
- Speed Insights request present in the network panel.

## 6. Merge and production

- Owner approves; merge the reviewed head SHA immediately (SHA-bound).
- Verify production: home and `/en|ja|vi/projects` return 200, the tree renders, quick view lists the SKG projects.
- Lift the admin freeze.

## 7. Rollback (in this order)

1. **App first:** Vercel Instant Rollback of production to the deployment before the merge (the old app must not read the new schema longer than needed, and the new app must not read the old one).
2. Run [experience-tree-rollback.sql](experience-tree-rollback.sql) in the hosted SQL editor (one transaction). It needs `private.experience_tree_backup`, so do it before the follow-up that drops the backup.
3. Redeploy the old app so cached pages render from the restored data: revert the merge on `main` and let it deploy to production (or use "Redeploy" on the pre-merge deployment). Never redeploy the merged code against the rolled-back schema.
4. Mark the migration reverted in the hosted history: delete its row from `supabase_migrations.schema_migrations` using the version recorded in step 4 (rollback file, step 8).
