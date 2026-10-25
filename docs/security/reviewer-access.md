# Read-only reviewer access

Status: prepared for owner security approval. Nothing in this document is applied to the hosted
project until the owner approves the concrete change. Account identifiers are deliberately absent
from this public file.

## Why

Every pull request that touches the admin used to need the owner to sign in to the preview and
click through a checklist. An AI reviewer can do those checks, but it must never use the owner's
full-admin account. Preview deployments share the production database, so one wrong "Save" would
change real content. The reviewer role sees everything an editor sees and cannot change anything.

## Access matrix

| Surface | Admin | Reviewer | Signed-in non-member | Anonymous |
| --- | --- | --- | --- | --- |
| Admin pages (proxy) | yes | yes (read-only UI) | redirected to login | redirected to login |
| Content tables, published rows | read/write | read | read | read |
| Content tables, hidden rows | read/write | read | no | no |
| Media/files bucket listing | list, upload, delete | list | no | no |
| Version history | list, restore | list | no | no |
| Live change notes (`admin:content`) | receive | receive | no | no |
| Draft-mode preview of hidden content | yes | no | no | no |
| `private.app_admins`, `private.app_reviewers`, Auth admin | no API access | no | no | no |
| Any server action that writes | yes | `FORBIDDEN` | `FORBIDDEN` | `SESSION_EXPIRED` |

## Where each guard lives

1. **Identity.**
   - The reviewer is a UID listed in `private.app_reviewers`. That schema is not exposed through the Data API.
   - `private.is_reviewer()` checks `auth.uid()`.
   - User metadata, email and request headers are never trusted.
   - Revocation is one `delete`. Pages, actions and the Data API refuse the reviewer on the next request. A Realtime channel that is already open keeps receiving change notes (table, operation and key only) until it rejoins or its access token refreshes, about an hour at most; for an immediate cut-off, also sign the reviewer out.
2. **Proxy** (`src/lib/admin/guard.ts`) lets the admin or the reviewer into `/admin/**`.
   - It decides through `public.admin_access_kind()`, a `security invoker` function that is not covered by Supabase lint 0029.
   - A lookup error means no access.
3. **Server.**
   - `getAdminAccess()` / `requireContentRead()` (`src/lib/admin/access.ts`) gate the read-only actions: history, media listing and the session check.
   - Every mutation keeps `requireAdmin()`. A reviewer calling an action directly gets `FORBIDDEN` before any database call.
4. **Database (the last guard).**
   - The reviewer has only `for select` policies.
   - No insert, update or delete policy and no grant exists for the role.
   - `admin_restore_version` checks `private.is_admin()` only.
5. **Interface.**
   - A permanent read-only notice is shown.
   - Forms render inside a disabled fieldset, without a save bar or drafts.
   - Toggles, reorder, duplicate, delete, upload and restore are absent.
   - Hiding controls is a convenience; the server and database are the guarantee.

## Residual risks (accepted by the owner)

- **Shared backend.** Preview and production use one database. The reviewer's read access therefore covers real content, including hidden items. The owner chose to allow the reviewer on production as well; the extra exposure is small because the database read scope is the same everywhere.
- **History contents.** Version history includes the editor's email in `changed_by`.
- **Session handling.** The owner signs the reviewer in once per pull request in the app's browser. Credentials and cookies are never exported to CI, reports or chat.

## Rollout (after approval)

1. Apply the migration `supabase/migrations/20261025065340_reviewer_read_only.sql` with its exact version, through `apply_migration` or the CLI, which run it as one transaction. Do not paste it into the SQL editor: a partial run cannot simply be repeated.
2. Verify, read-only:
   - `public.admin_access_kind()` is `security invoker`, executable by `authenticated` only;
   - the 10 `*_reviewer_read` policies, `reviewer_media_select`, `content_versions_reviewer_read` and `reviewer_content_receive` exist;
   - the security advisor shows no new warning.
3. The owner creates the dedicated account, signs in once, and adds it:
   ```sql
   insert into private.app_reviewers (user_id) values ('<reviewer-uid>');
   ```
4. Confirm reviewer reads on preview and production through the UI. No write probes run against hosted data; write denial is proven in the disposable CI database.

## Revoke

```sql
delete from private.app_reviewers where user_id = '<reviewer-uid>';
```

## Rollback

```sql
drop policy if exists "reviewer_content_receive" on realtime.messages;
drop policy if exists "content_versions_reviewer_read" on private.content_versions;
drop policy if exists "reviewer_media_select" on storage.objects;
-- one per content table:
drop policy if exists "profile_reviewer_read" on public.profile;
drop policy if exists "roles_reviewer_read" on public.roles;
drop policy if exists "experiences_reviewer_read" on public.experiences;
drop policy if exists "projects_reviewer_read" on public.projects;
drop policy if exists "skills_reviewer_read" on public.skills;
drop policy if exists "skill_links_reviewer_read" on public.skill_links;
drop policy if exists "certificates_reviewer_read" on public.certificates;
drop policy if exists "activities_reviewer_read" on public.activities;
drop policy if exists "education_reviewer_read" on public.education;
drop policy if exists "why_cards_reviewer_read" on public.why_cards;
-- restore the admin-only history listing:
create or replace function public.admin_list_versions(p_table text, p_key text)
returns table (id bigint, op text, old_row jsonb, changed_by text, changed_at timestamptz)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select v.id, v.op, v.old_row, v.changed_by, v.changed_at
    from private.content_versions v
    where v.table_name = p_table and v.item_key = p_key
    order by v.id desc
    limit 50;
end;
$$;
drop function if exists public.admin_access_kind();
drop function if exists private.is_reviewer();
drop table if exists private.app_reviewers;
```

Then mark the migration as reverted, so a later migration run applies it again instead of
skipping it:

```bash
supabase migration repair --status reverted 20261025065340
```

Rolling back only the database is safe for the app: when `admin_access_kind()` is missing, the
lookup fails and the app falls back to admin-only access.

Rolling back only the code is **not** enough. The reviewer's session could still read hidden
rows, history, media listings and change notes directly through the Data API, Storage and
Realtime. Run the Revoke `delete` above too, or the full database rollback.

## Evidence

- Unit tests: SQL shape, the access resolver matrix (including metadata-bypass and revocation cases), proxy behaviour, and every mutation refusing the reviewer before any database call.
- Real-service checks: the disposable Supabase in the Linux CI admin job signs in the reviewer and checks the following, then deletes the allowlist row and checks again.
  - Reads: hidden rows, history, media listing, realtime join.
  - Denials: insert/update/delete, upload, restore, private schema.
