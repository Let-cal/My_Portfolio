-- After the experience tree rollout (20261027094023) was accepted on 2026-10-31.
-- 1. Index the two project links (Supabase advisor: unindexed foreign keys).
-- 2. Drop the rollout backup. From here on docs/experience-tree-rollback.sql can no longer run.
create index projects_experience_id on public.projects (experience_id);
create index projects_education_id on public.projects (education_id);

drop table private.experience_tree_backup;
