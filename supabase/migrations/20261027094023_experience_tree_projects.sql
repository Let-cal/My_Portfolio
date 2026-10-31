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
--    to demo_url, every other link stays in links. They are numbered after the existing projects,
--    in their old order (the backup keeps the old sort_index for the rollback).
insert into public.projects (id, title, role, start_month, end_month, summary, case_study, tech, demo_url, repo_urls, links, team_size, published, sort_index, kind, experience_id, roles, created_at, updated_at)
  select
    case e.id when 'skg-intern' then 'tongue-ai-driver-ms' else e.id end,
    e.company, e.position, e.start_month, e.end_month, e.summary, e.case_study, e.tech,
    (select l ->> 'url' from jsonb_array_elements(e.links) with ordinality as x(l, n) where n = d.demo_n),
    array(select l ->> 'url' from jsonb_array_elements(e.links) with ordinality as x(l, n) where l ->> 'label' = 'Code' order by n),
    coalesce((select jsonb_agg(l order by n) from jsonb_array_elements(e.links) with ordinality as x(l, n)
      where l ->> 'label' <> 'Code' and n is distinct from d.demo_n), '[]'::jsonb),
    e.team_size, e.published,
    (select coalesce(max(sort_index), -1) from public.projects) + row_number() over (order by e.sort_index, e.id),
    'work',
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

-- 11. Version restore after the move (same text as RESTORE_BARRIERS_SQL in src/lib/data/schema-sql.ts):
--     project versions written before step 1 restore with the new columns kept or defaulted, and
--     versions of the five moved experience rows up to now are refused with a pointer to the project.
-- Restore barriers: versions of an item up to last_version_id cannot be restored (its content moved).
create table private.restore_barriers (
  table_name text not null,
  item_key text not null,
  last_version_id bigint not null,
  reason text not null,
  primary key (table_name, item_key)
);
alter table private.restore_barriers enable row level security;
revoke all on private.restore_barriers from public, anon, authenticated;
grant select on private.restore_barriers to authenticated;
create policy "restore_barriers_admin_read" on private.restore_barriers for select to authenticated using (private.is_admin());

-- Restore as before; an old row missing a newer column keeps the current value or takes the default.
create or replace function public.admin_restore_version(p_version_id bigint) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v private.content_versions;
  pk text;
  cols text;
  sets text;
  default_list text;
  fill jsonb;
  barrier_reason text;
  link private.content_versions;
begin
  if not private.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into v from private.content_versions where content_versions.id = p_version_id;
  if not found then
    raise exception 'version % not found', p_version_id;
  end if;
  if v.table_name not in ('profile', 'roles', 'experiences', 'projects', 'skills', 'skill_links', 'certificates', 'activities', 'education', 'why_cards') or v.table_name = 'skill_links' then
    raise exception 'cannot restore %', v.table_name;
  end if;
  select b.reason into barrier_reason from private.restore_barriers b
  where b.table_name = v.table_name and b.item_key = v.item_key and v.id <= b.last_version_id;
  if found then
    raise exception 'cannot restore version %: %', p_version_id, barrier_reason using errcode = '22023';
  end if;
  pk := case v.table_name when 'roles' then 'key' else 'id' end;
  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         -- An edit restore keeps the current position: reorders write no version, so the old
         -- sort_index may be stale. A deleted item comes back at its old position (insert below).
         string_agg(format('%1$I = excluded.%1$I', c.column_name), ', ' order by c.ordinal_position)
           filter (where c.column_name <> 'sort_index')
    into cols, sets
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = v.table_name;
  -- Keys the old row lacks: the current row's values, else the column defaults.
  if v.op = 'update' then
    execute format('select to_jsonb(t) from public.%1$I t where t.%2$I = $1', v.table_name, pk)
      into fill using v.item_key;
  end if;
  if fill is null then
    select string_agg(format('%L, %s', a.attname, pg_catalog.pg_get_expr(d.adbin, d.adrelid)), ', ')
      into default_list
      from pg_catalog.pg_attrdef d
      join pg_catalog.pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
      where d.adrelid = format('public.%I', v.table_name)::pg_catalog.regclass and not a.attisdropped;
    execute format('select jsonb_build_object(%s)', coalesce(default_list, '')) into fill;
  end if;
  fill := fill || v.old_row;
  if v.op = 'update' then
    execute format(
      'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) on conflict (%3$I) do update set %4$s',
      v.table_name, cols, pk, sets
    ) using fill;
  else
    execute format(
      'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) on conflict (%3$I) do nothing',
      v.table_name, cols, pk
    ) using fill;
    for link in
      select * from private.content_versions l
      where l.txid = v.txid and l.table_name = 'skill_links' and l.op = 'delete'
    loop
      insert into public.skill_links (skill_id, experience_id, project_id, created_at, updated_at)
      select r.skill_id, r.experience_id, r.project_id, r.created_at, r.updated_at
      from jsonb_populate_record(null::public.skill_links, link.old_row) r
      where exists (select 1 from public.skills s where s.id = r.skill_id)
        and (r.experience_id is null or exists (select 1 from public.experiences e where e.id = r.experience_id))
        and (r.project_id is null or exists (select 1 from public.projects p where p.id = r.project_id))
      on conflict do nothing;
    end loop;
  end if;
end;
$$;
revoke execute on function public.admin_restore_version(bigint) from public, anon;
grant execute on function public.admin_restore_version(bigint) to authenticated;

insert into private.restore_barriers (table_name, item_key, last_version_id, reason)
  select 'experiences', m.id, v.last_id,
    'its content moved to project ' || m.project || ' (experience tree); restore that project instead'
  from (values ('skg-ai-agent', 'skg-ai-agent'), ('skg-flexybox-p2', 'skg-flexybox-p2'), ('skg-coa', 'skg-coa'),
    ('skg-flexybox-p1', 'skg-flexybox-p1'), ('skg-intern', 'tongue-ai-driver-ms')) as m(id, project)
  cross join (select max(id) as last_id from private.content_versions) v
  where v.last_id is not null;

drop function pg_temp.role_tags(text);
