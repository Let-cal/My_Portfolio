-- Rollback for supabase/migrations/*_experience_tree_projects.sql (experience tree).
-- Order (docs/experience-tree-rollout.md, section 7): roll the production app back first (Vercel
-- Instant Rollback), then run this file in the SQL editor of the hosted project as one transaction,
-- then redeploy the old app, then remove the migration's row from
-- supabase_migrations.schema_migrations (step 8).
--
-- The five experience rows take their content (title, position, period, summary, case study,
-- tech, team size, published) from the projects rows, so edits made after the migration are
-- kept; location, parent company, employment type, links, sort index and timestamps come from
-- private.experience_tree_backup, which the migration filled.
-- Stops with an error, changing nothing, if a project still points at skg-engineer
-- (move it first) or if the backup table is missing.

begin;

-- 1. The four moved experience rows come back.
insert into public.experiences (id, company, parent_company, location, position, start_month, end_month, employment_type, summary, case_study, team_size, tech, links, published, sort_index, created_at, updated_at)
  select prev.id, p.title, prev.parent_company, prev.location, p.role, p.start_month, p.end_month,
    prev.employment_type, p.summary, p.case_study, p.team_size, p.tech, prev.links, p.published,
    prev.sort_index, prev.created_at, prev.updated_at
  from private.experience_tree_backup b
  cross join lateral jsonb_populate_record(null::public.experiences, b.data) as prev
  join public.projects p on p.id = prev.id
  where b.source = 'experiences' and prev.id <> 'skg-intern';

-- 2. skg-intern gets its TONGUE-AI & Driver MS content back from that project.
update public.experiences e set
    company = p.title,
    parent_company = prev.parent_company,
    location = prev.location,
    position = p.role,
    start_month = p.start_month,
    end_month = p.end_month,
    employment_type = prev.employment_type,
    summary = p.summary,
    case_study = p.case_study,
    team_size = p.team_size,
    tech = p.tech,
    links = prev.links,
    published = p.published,
    sort_index = prev.sort_index
  from private.experience_tree_backup b
  cross join lateral jsonb_populate_record(null::public.experiences, b.data) as prev
  join public.projects p on p.id = 'tongue-ai-driver-ms'
  where b.source = 'experiences' and b.id = 'skg-intern' and e.id = 'skg-intern';

-- 3. Skill links go back to the experience rows.
update public.skill_links
  set experience_id = case project_id when 'tongue-ai-driver-ms' then 'skg-intern' else project_id end,
    project_id = null
  where project_id in ('skg-ai-agent', 'skg-flexybox-p2', 'skg-coa', 'skg-flexybox-p1', 'tongue-ai-driver-ms');

-- 4. Why-card links and every role's experience_order as they were before the migration.
update public.why_cards w
  set evidence_link = b.data #>> '{}'
  from private.experience_tree_backup b
  where b.source = 'why_cards' and b.id = w.id;
update public.roles r
  set experience_order = array(select jsonb_array_elements_text(b.data))
  from private.experience_tree_backup b
  where b.source = 'roles' and b.id = r.key;

-- 5. The five work projects and the engineer stint go (history keeps the deleted rows).
delete from public.projects
  where id in ('skg-ai-agent', 'skg-flexybox-p2', 'skg-coa', 'skg-flexybox-p1', 'tongue-ai-driver-ms');
delete from public.experiences where id = 'skg-engineer';

-- 6. The columns, the kind/link rule and the backup go.
alter table public.projects
  drop constraint projects_kind_matches_link,
  drop column experience_id,
  drop column education_id,
  drop column kind,
  drop column featured,
  drop column featured_order,
  drop column roles,
  drop column team_size,
  drop column links;
drop table private.experience_tree_backup;

-- 7. Version restore as before the migration (content_versions + versions_security_invoker), then
--    the restore barriers go.
create or replace function public.admin_restore_version(p_version_id bigint) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v private.content_versions;
  pk text;
  cols text;
  sets text;
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
  pk := case v.table_name when 'roles' then 'key' else 'id' end;
  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         -- An edit restore keeps the current position: reorders write no version, so the old
         -- sort_index may be stale. A deleted item comes back at its old position (insert below).
         string_agg(format('%1$I = excluded.%1$I', c.column_name), ', ' order by c.ordinal_position)
           filter (where c.column_name <> 'sort_index')
    into cols, sets
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = v.table_name;
  if v.op = 'update' then
    execute format(
      'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) on conflict (%3$I) do update set %4$s',
      v.table_name, cols, pk, sets
    ) using v.old_row;
  else
    execute format(
      'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) on conflict (%3$I) do nothing',
      v.table_name, cols, pk
    ) using v.old_row;
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
drop table private.restore_barriers;

-- 8. Forget the migration (use the version the hosted history recorded for it).
-- delete from supabase_migrations.schema_migrations where version = '<hosted version>';

commit;
