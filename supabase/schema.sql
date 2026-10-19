-- Current schema, generated from src/lib/data/columns.ts by `npm run db:schema`.
-- Do not edit by hand. Changes to a live database go in supabase/migrations/.

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Admin checks live in a private schema that the Data API does not expose.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- Admins are listed by email; only the service role can read or change this table.
create table private.app_admins (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table private.app_admins enable row level security;
revoke all on private.app_admins from public, anon, authenticated;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.app_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

create table public.profile (
  id text not null default 'me' primary key check (id = 'me'),
  name text not null,
  location text not null,
  email text not null,
  linkedin text not null,
  github text not null,
  avatar_url text,
  open_to_work boolean not null default true,
  availability_note jsonb not null,
  booking_url text,
  summaries jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profile_updated_at before update on public.profile for each row execute function public.set_updated_at();
alter table public.profile enable row level security;
create policy "profile_read" on public.profile for select to anon, authenticated using (true);
create policy "profile_write" on public.profile for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.roles (
  key text not null primary key,
  title jsonb not null,
  koi_variety text not null,
  cv_file_url text not null,
  experience_order text[] not null default '{}',
  skill_group_order text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger roles_updated_at before update on public.roles for each row execute function public.set_updated_at();
alter table public.roles enable row level security;
create policy "roles_read" on public.roles for select to anon, authenticated using (true);
create policy "roles_write" on public.roles for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.experiences (
  id text not null primary key,
  company text not null,
  parent_company text,
  location text not null,
  position jsonb not null,
  start_month text not null,
  end_month text,
  employment_type text not null,
  summary jsonb not null,
  case_study jsonb,
  team_size text,
  tech text[] not null default '{}',
  links jsonb not null default '[]',
  published boolean not null default true,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger experiences_updated_at before update on public.experiences for each row execute function public.set_updated_at();
alter table public.experiences enable row level security;
create policy "experiences_read" on public.experiences for select to anon, authenticated using (published or private.is_admin());
create policy "experiences_write" on public.experiences for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.projects (
  id text not null primary key,
  title text not null,
  role jsonb not null,
  start_month text not null,
  end_month text,
  summary jsonb not null,
  case_study jsonb,
  tech text[] not null default '{}',
  demo_url text,
  repo_urls text[] not null default '{}',
  poster_url text,
  video_url text,
  published boolean not null default true,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
alter table public.projects enable row level security;
create policy "projects_read" on public.projects for select to anon, authenticated using (published or private.is_admin());
create policy "projects_write" on public.projects for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.skills (
  id text not null primary key,
  name text not null,
  skill_group text not null,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger skills_updated_at before update on public.skills for each row execute function public.set_updated_at();
alter table public.skills enable row level security;
create policy "skills_read" on public.skills for select to anon, authenticated using (true);
create policy "skills_write" on public.skills for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.skill_links (
  skill_id text not null references public.skills (id) on delete cascade,
  experience_id text references public.experiences (id) on delete cascade,
  project_id text references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((experience_id is null) <> (project_id is null)),
  unique nulls not distinct (skill_id, experience_id, project_id)
);
create trigger skill_links_updated_at before update on public.skill_links for each row execute function public.set_updated_at();
alter table public.skill_links enable row level security;
create policy "skill_links_read" on public.skill_links for select to anon, authenticated using (true);
create policy "skill_links_write" on public.skill_links for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.certificates (
  id text not null primary key,
  name text not null,
  organization text not null,
  issue_date text not null,
  credential_id text,
  credential_url text,
  file_url text,
  topic text not null,
  skills text[] not null default '{}',
  description jsonb not null,
  published boolean not null default true,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger certificates_updated_at before update on public.certificates for each row execute function public.set_updated_at();
alter table public.certificates enable row level security;
create policy "certificates_read" on public.certificates for select to anon, authenticated using (published or private.is_admin());
create policy "certificates_write" on public.certificates for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.activities (
  id text not null primary key,
  name jsonb not null,
  event_date text not null,
  skills text[] not null default '{}',
  description jsonb not null,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger activities_updated_at before update on public.activities for each row execute function public.set_updated_at();
alter table public.activities enable row level security;
create policy "activities_read" on public.activities for select to anon, authenticated using (true);
create policy "activities_write" on public.activities for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.education (
  id text not null primary key,
  school text not null,
  degree jsonb not null,
  major jsonb not null,
  start_month text not null,
  end_month text,
  gpa text,
  notes jsonb,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger education_updated_at before update on public.education for each row execute function public.set_updated_at();
alter table public.education enable row level security;
create policy "education_read" on public.education for select to anon, authenticated using (true);
create policy "education_write" on public.education for all to authenticated using (private.is_admin()) with check (private.is_admin());

create table public.why_cards (
  id text not null primary key,
  title jsonb not null,
  subtitle jsonb not null,
  tag jsonb not null,
  body jsonb not null,
  colors text[] not null,
  evidence_link text,
  stat jsonb,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger why_cards_updated_at before update on public.why_cards for each row execute function public.set_updated_at();
alter table public.why_cards enable row level security;
create policy "why_cards_read" on public.why_cards for select to anon, authenticated using (true);
create policy "why_cards_write" on public.why_cards for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Public read for uploaded media and files; only admins may write.
insert into storage.buckets (id, name, public) values ('media', 'media', true), ('files', 'files', true)
  on conflict (id) do update set public = excluded.public;
create policy "admin_upload" on storage.objects for insert to authenticated with check (bucket_id in ('media', 'files') and private.is_admin());
create policy "admin_update" on storage.objects for update to authenticated using (bucket_id in ('media', 'files') and private.is_admin());
create policy "admin_delete" on storage.objects for delete to authenticated using (bucket_id in ('media', 'files') and private.is_admin());
