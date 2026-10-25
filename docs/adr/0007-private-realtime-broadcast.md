# ADR-0007: Live admin updates through a private Realtime Broadcast topic

- Status: Accepted
- Date: 2026-10-20
- Introduced in: [PR #13](https://github.com/Let-cal/My_Portfolio/pull/13)

## Context

After a save, other admin tabs and devices kept showing stale lists until a reload. The goal was updates in other tabs within about one to two seconds, without overwriting a form that is being edited ([realtime design spec](../superpowers/specs/2026-10-20-admin-realtime-design.md)).

Supabase offers two mechanisms. Postgres Changes was rejected for two reasons recorded in the spec:

- it needs `skill_links` in the publication, and that table has no primary key, so deletes on it would fail on the shared production database;
- it would also deliver delete events to anonymous users.

## Decision

- `private.broadcast_content_change()` runs `after insert or update or delete` on each of the 10 content tables and calls `realtime.send` on the private topic `admin:content` (`20261020160958_admin_realtime.sql`).
- The payload is only `{ table, op, key }`, never the row.
- A send failure is swallowed inside the trigger: live updates are a convenience, and the save must always succeed.
- The policy `admin_content_receive` on `realtime.messages` allows SELECT only when the topic is `admin:content` and `private.is_admin()` is true.
- The client (`src/components/admin/RealtimeSync.tsx`) joins with `private: true`, debounces notes for 400 ms, then calls `router.refresh()`. It:
  - passes each note to open forms, which never replace unsaved edits;
  - holds refreshes on a page whose item was deleted elsewhere while it has unsaved edits;
  - does not toast for the tab's own writes;
  - refreshes once after a dropped connection comes back.

## Consequences

Positive:

- Anonymous and signed-in non-admin users cannot receive change notes, and the notes carry no content.
- Changes made outside the app, for example in the SQL editor, also produce notes, because the database sends them.
- No publication change is needed, so `skill_links` keeps working.

Negative / trade-offs:

- A swallowed send failure means another tab may stay stale until its next navigation or reconnect.
- Each note triggers a server re-render of the current screen instead of a client-side patch.
- A Realtime channel that is already open is authorized when it joins; revoking access takes effect on rejoin or token refresh. This matters for the proposed reviewer role ([ADR-0013](0013-read-only-reviewer-role.md)).

## Evidence

- Migration: [20261020160958_admin_realtime.sql](../../supabase/migrations/20261020160958_admin_realtime.sql)
- Client: [src/components/admin/RealtimeSync.tsx](../../src/components/admin/RealtimeSync.tsx), [src/lib/admin/sync.ts](../../src/lib/admin/sync.ts), [src/lib/admin/own-writes.ts](../../src/lib/admin/own-writes.ts)
- Tests: [tests/unit/realtime-sync.test.tsx](../../tests/unit/realtime-sync.test.tsx), [tests/unit/form-incoming.test.tsx](../../tests/unit/form-incoming.test.tsx); private-topic rejection for anonymous and member sessions plus admin delivery run against a real local stack in the disposable admin job ([ADR-0010](0010-disposable-supabase-integration-tests.md))
- Design and plan: [spec](../superpowers/specs/2026-10-20-admin-realtime-design.md), [plan](../superpowers/plans/2026-10-20-admin-realtime.md)
