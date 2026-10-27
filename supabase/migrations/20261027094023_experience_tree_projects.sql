-- Experience tree (spec docs/superpowers/specs/2026-10-27-experience-tree-and-projects-design.md §5.2).
-- Projects belong to a company stint, a school or nobody. The five SKG project rows move from
-- experiences into projects; experiences become position stints (skg-intern converted in place,
-- skg-engineer added). The CLI and apply_migration run this file as one transaction.
-- On an empty database (CI replay) every data step matches no rows.
-- Rollback: docs/experience-tree-rollback.sql.

-- 1. New project columns and the kind/link rule (mirrors src/lib/data/columns.ts).
alter table public.projects
  add column experience_id text references public.experiences (id) on delete restrict,
  add column education_id text references public.education (id) on delete restrict,
  add column kind text not null default 'personal' check (kind in ('work', 'university', 'personal')),
  add column featured boolean not null default false,
  add column featured_order integer,
  add column roles text[] not null default '{}',
  add column team_size text,
  add column links jsonb not null default '[]',
  add constraint projects_kind_matches_link check ((kind = 'work' and experience_id is not null and education_id is null) or (kind = 'university' and education_id is not null and experience_id is null) or (kind = 'personal' and experience_id is null and education_id is null));

-- 2. Keep what the rollback cannot rebuild from the projects rows: the five experience rows
--    as they are now, every role's experience_order and the why-card links this file rewrites.
--    Private (not in the Data API, no grants); drop it in a later migration once rollback is ruled out.
create table private.experience_tree_backup (
  source text not null,
  id text not null,
  data jsonb not null,
  primary key (source, id)
);
alter table private.experience_tree_backup enable row level security;
revoke all on private.experience_tree_backup from public, anon, authenticated;
insert into private.experience_tree_backup (source, id, data)
  select 'experiences', e.id, to_jsonb(e) from public.experiences e
  where e.id in ('skg-ai-agent', 'skg-flexybox-p2', 'skg-coa', 'skg-flexybox-p1', 'skg-intern')
  union all
  select 'roles', r.key, to_jsonb(r.experience_order) from public.roles r
  union all
  select 'why_cards', w.id, to_jsonb(w.evidence_link) from public.why_cards w
  where w.evidence_link in ('#exp-skg-ai-agent', '#exp-skg-flexybox-p2', '#exp-skg-coa', '#exp-skg-flexybox-p1', '#exp-skg-intern');

-- Role highlight tags from position text: "PM" or "Project Manager" -> pm, "Tech Lead" -> techlead,
-- "Full-stack" / "Developer" / "front-end" -> fullstack. The owner adjusts them in the admin.
create function pg_temp.role_tags(title text) returns text[]
language sql immutable as $$
  select array_remove(array[
    case when title ~* '(full-stack|developer|front-end)' then 'fullstack' end,
    case when title ~* 'tech lead' then 'techlead' end,
    case when title ~ '\mPM\M' or title ~* 'project manager' then 'pm' end
  ], null);
$$;

-- 3. The Software Engineer stint (Oct 2025 – Sep 2026), title from messages experience.skgEngineer.
insert into public.experiences (id, company, parent_company, location, position, start_month, end_month, employment_type, summary, case_study, team_size, tech, links, published, sort_index)
  select 'skg-engineer', 'SKG Software (Splus)', 'SKG Software (Splus)', e.location,
    '{"en":"Software Engineer — acting Project Manager / Tech Lead","ja":"ソフトウェアエンジニア(プロジェクトマネージャー/テックリード代行)","vi":"Kỹ sư phần mềm, kiêm Project Manager / Tech Lead"}'::jsonb,
    '2025-10', '2026-09', 'full-time', '{"en":""}'::jsonb, null, null, '{}', '[]', true, 0
  from public.experiences e
  where e.id = 'skg-intern';

-- 4. Copy the five project rows into projects. Ids stay; the internship's TONGUE-AI & Driver MS
--    content becomes tongue-ai-driver-ms. A "Code" link goes to repo_urls, the first "Demo" link
--    to demo_url, every other link stays in links.
insert into public.projects (id, title, role, start_month, end_month, summary, case_study, tech, demo_url, repo_urls, links, team_size, published, sort_index, kind, experience_id, roles, created_at, updated_at)
  select
    case e.id when 'skg-intern' then 'tongue-ai-driver-ms' else e.id end,
    e.company, e.position, e.start_month, e.end_month, e.summary, e.case_study, e.tech,
    (select l ->> 'url' from jsonb_array_elements(e.links) with ordinality as x(l, n) where n = d.demo_n),
    array(select l ->> 'url' from jsonb_array_elements(e.links) with ordinality as x(l, n) where l ->> 'label' = 'Code' order by n),
    coalesce((select jsonb_agg(l order by n) from jsonb_array_elements(e.links) with ordinality as x(l, n)
      where l ->> 'label' <> 'Code' and n is distinct from d.demo_n), '[]'::jsonb),
    e.team_size, e.published, e.sort_index, 'work',
    case when e.id in ('skg-intern', 'skg-flexybox-p1') then 'skg-intern' else 'skg-engineer' end,
    pg_temp.role_tags(e.position ->> 'en'),
    e.created_at, e.updated_at
  from public.experiences e
  cross join lateral (
    select min(n) as demo_n from jsonb_array_elements(e.links) with ordinality as x(l, n) where l ->> 'label' = 'Demo'
  ) d
  where e.id in ('skg-ai-agent', 'skg-flexybox-p2', 'skg-coa', 'skg-flexybox-p1', 'skg-intern');

-- 5. Skill links follow their rows to the projects.
update public.skill_links
  set project_id = case experience_id when 'skg-intern' then 'tongue-ai-driver-ms' else experience_id end,
    experience_id = null
  where experience_id in ('skg-ai-agent', 'skg-flexybox-p2', 'skg-coa', 'skg-flexybox-p1', 'skg-intern');

-- 6. skg-intern becomes the internship stint in place (Aug – Oct 2025, title from messages
--    experience.skgIntern), so its version history continues.
update public.experiences set
    company = 'SKG Software (Splus)',
    parent_company = 'SKG Software (Splus)',
    position = '{"en":"Software Engineer Intern","ja":"ソフトウェアエンジニアインターン","vi":"Thực tập sinh kỹ sư phần mềm"}'::jsonb,
    start_month = '2025-08',
    end_month = '2025-10',
    employment_type = 'internship',
    summary = '{"en":""}'::jsonb,
    case_study = null,
    team_size = null,
    tech = '{}',
    links = '[]',
    sort_index = 1
  where id = 'skg-intern';

-- 7. University projects belong to FPT University and are starred in this order (the home page
--    keeps its three cards); other existing projects stay personal. Text is not touched.
update public.projects p
  set kind = 'university', education_id = 'fpt-university', featured = true, featured_order = u.n,
    roles = pg_temp.role_tags(p.role ->> 'en')
  from (values ('siteplus', 1), ('zodiacgems', 2), ('meet-my-lecturer', 3)) as u(id, n)
  where p.id = u.id and exists (select 1 from public.education where id = 'fpt-university');
update public.projects set roles = pg_temp.role_tags(role ->> 'en') where kind = 'personal';

-- 8. Why cards that pointed at a moved row point at its tree card.
update public.why_cards
  set evidence_link = case evidence_link when '#exp-skg-intern' then '#tree-tongue-ai-driver-ms'
    else '#tree-' || substr(evidence_link, length('#exp-') + 1) end
  where evidence_link in ('#exp-skg-ai-agent', '#exp-skg-flexybox-p2', '#exp-skg-coa', '#exp-skg-flexybox-p1', '#exp-skg-intern');

-- 9. Every role lists the stints, newest first, then the experiences it already listed.
update public.roles
  set experience_order = array['skg-engineer', 'skg-intern'] || array(
    select x from unnest(experience_order) with ordinality as o(x, n)
    where x not in ('skg-ai-agent', 'skg-flexybox-p2', 'skg-coa', 'skg-flexybox-p1', 'skg-intern', 'skg-engineer')
    order by n)
  where exists (select 1 from public.experiences where id = 'skg-engineer');

-- 10. The four moved experience rows go (their links already moved; history keeps the old rows).
delete from public.experiences where id in ('skg-ai-agent', 'skg-flexybox-p2', 'skg-coa', 'skg-flexybox-p1');

drop function pg_temp.role_tags(text);
