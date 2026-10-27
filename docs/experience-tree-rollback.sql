-- Rollback for supabase/migrations/*_experience_tree_projects.sql (experience tree).
-- Run in the SQL editor of the hosted project, as one transaction. Afterwards remove the
-- migration's row from supabase_migrations.schema_migrations (step 7) and revert the app.
--
-- The five experience rows take their content (title, position, period, summary, case study,
-- tech, team size, published, sort index) from the projects rows, so edits made after the
-- migration are kept; location, parent company, employment type, links and timestamps come
-- from private.experience_tree_backup, which the migration filled.
-- Stops with an error, changing nothing, if a project still points at skg-engineer
-- (move it first) or if the backup table is missing.

begin;

-- 1. The four moved experience rows come back.
insert into public.experiences (id, company, parent_company, location, position, start_month, end_month, employment_type, summary, case_study, team_size, tech, links, published, sort_index, created_at, updated_at)
  select prev.id, p.title, prev.parent_company, prev.location, p.role, p.start_month, p.end_month,
    prev.employment_type, p.summary, p.case_study, p.team_size, p.tech, prev.links, p.published,
    p.sort_index, prev.created_at, prev.updated_at
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
    sort_index = p.sort_index
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

-- 7. Forget the migration (use the version the hosted history recorded for it).
-- delete from supabase_migrations.schema_migrations where version = '<hosted version>';

commit;
