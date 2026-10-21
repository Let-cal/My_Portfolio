# Admin cross-tab session recovery implementation plan

> **For agentic workers:** Use superpowers:executing-plans for this approved bugfix.

**Goal:** Fix PR #13 session expiration and login pending without losing open edits.
**Spec:** Approved chat flow on 2026-10-21 and docs/superpowers/specs/2026-10-20-admin-realtime-design.md R5.
**Architecture:** Auth events update a shared blocked-session state separate from dialog visibility. Keep server proxy/action/RLS checks. Suppress automatic refresh and client navigation while blocked; validate reauthentication before resuming. Full-document auth transitions clear stale router state. Login failures/timeouts always release pending; never auto-save.
**Tech stack:** Existing Next16, React19, Supabase SSR, Vitest; no dependency/database change.

## Constraints and review focus
- Stay on feat/admin-realtime / PR13. Preserve user .lcp-probe.tmp.mjs and existing servers.
- No passwords entered by agent; no production content writes. Real two-tab check requires user auth or isolated test doubles.
- Dialog dismissal does not restore authorization; server continues to reject writes.
- Ignore late auth checks after sign-out/unmount; never call refresh on recovery of dirty forms.
- Local sign-out must not be confused with other-tab expiry. Login throw/hang/navigation failure must clear pending.

## Task 1: Session lifecycle and preservation
- [x] Add failing tests for auth events, dialog dismissal vs block, verified recovery, refresh suppression and navigation hold.
- [x] Implement shared state, AdminSessionSync and panel integration; keep server action expiry path.
- [x] Run focused tests and type/lint.

## Task 2: Auth boundary navigation
- [x] Add failing login tests for rejected/hung requests, late completion and navigation, sign-out failures.
- [x] Implement bounded pending and full-document safe-next navigation; intentional sign-out marker.
- [x] Run focused tests then npm run verify. Review whole patch, fix important findings, commit/push to PR13 and inspect CI. Do not merge PR13 without owner completing checklist/asking merge.

## Verification and review record

- npm run verify: 112 files / 1210 tests, format, lint (one pre-existing React Hook Form warning), generated assets, route types, build, JS budgets and 50 artifact tests pass.
- Regression failures observed before fixes: missing auth/session/router components, late queued sign-in unblocking sign-out, sticky sign-out intent, and returned network errors mislabeled as invalid credentials.
- Whole-patch review found three important lifecycle gaps; guarded programmatic navigation, persisted blocked state for local sign-out, reconciled failed logout, and cleared intentional sign-out after navigation so cancellation cannot leave bypass state.
- Production-build Chromium smoke: anonymous guard redirect, intercepted invalid credentials and aborted auth transport recover button state; zero page exceptions. Test requests were intercepted before Supabase; no database content writes.
- Real authenticated two-tab Supabase verification remains the owner's preview checklist, not claimed by the mocked event regressions. PR13 is updated without merging.
- Implementation call: login wait is bounded at 20 seconds; late completion cannot trigger navigation. Server authorization and RLS are unchanged.

