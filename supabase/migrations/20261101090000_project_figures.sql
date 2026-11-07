-- Case study gallery (spec docs/superpowers/specs/2026-10-31-case-study-gallery-design.md §5).
-- Adds projects.media: an ordered jsonb array of figures (images and rendered diagrams), at most
-- 12 per project (enforced by the content schema). Mirrors src/lib/data/columns.ts.
-- Additive only: existing rows get '[]'. The CLI and apply_migration run this file as one transaction.
-- Rollback: by hand, remove the constraint and then the column with alter table.

alter table public.projects add column media jsonb not null default '[]'::jsonb;
alter table public.projects add constraint projects_media_is_array check (jsonb_typeof(media) = 'array');
