# Disposable admin integration: safety foundation

Status: **partial local preparation, not an integration test or release gate**.

This separately reviewable branch implements the destination and environment validation portion of Task 4 in the approved final-review/release design. It does not launch services, reset a database, apply migrations, seed users, exercise CRUD, change Auth/RLS or add a workflow. Docker is unavailable in the current workstation environment. None of the pure tests below establish service ownership, validate a real JWT signature or verify Supabase behavior.

## Implemented contract

- `assertLocalSupabase(url)` accepts only explicit HTTP loopback API origins using `127.0.0.1`, `localhost` or `[::1]` and a non-default port. It rejects hosted URLs, URL normalization tricks, userinfo, unexpected paths, query strings and fragments before parsing.
- `assertLocalDatabaseUrl(url)` restricts the DSN to an explicit loopback port and the disposable CLI default `postgres:postgres` / `postgres` identity. A different local identity requires a reviewed extension. This syntax check does not prove which database is listening.
- `buildLocalSupabaseEnv({ status, provenance, inheritedEnv })` takes explicit inputs, rejects inherited backend/auth/secrets/proxy settings, and creates a fresh app-only allowlist. It does not copy `process.env` or return a database/service-role credential. Status is a projection containing only `API_URL`, `DB_URL`, `ANON_KEY`; the future launcher must privately read CLI output and explicitly project these fields.
- The caller's project/run marker and endpoint agreement are consistency checks only. A marker is forgeable and cannot authorize a seed/reset. The local anonymous key check is restricted to the documented legacy local shape with `supabase-demo` issuer; it checks claims/encoding, not signature or actual service identity. New CLI key formats must be deliberately supported and verified, not accepted by disabling the guard.
- Validation errors omit the rejected URLs, DSNs and keys. Test credentials and tokens are synthetic and have no relationship to hosted accounts.

## Verification

```powershell
node --test tests/scripts/local-supabase.test.mjs
```

These are pure configuration safety tests. Actual service integration remains **BLOCKED**, not passed or skipped-as-success.

## Remaining Task 4 work

1. Pin and verify the official Supabase CLI/config workflow against current documentation.
2. Establish an owned disposable Docker environment, with no hosted project linkage or inherited production credentials. Prove container/project/run ownership before any destructive operation; loopback alone is insufficient and could point at another developer service or forwarded production endpoint.
3. Replay migrations into a genuinely empty local database and create synthetic admin/ordinary identities. Never rewrite deployed migration history or reuse hosted service-role credentials.
4. Exercise real login, CRUD, ordering, visibility, drafts, cross-tab expiration/conflict and media reference protection. Media coverage depends on PR #15 being integrated explicitly.
5. Prepare the exact scoped Linux CI addition for owner approval before publication. Preserve existing gate names and avoid repeating the public suite merely to add admin coverage.
6. Prepare preview reviewer access in the separate approved Auth/RLS increment. It is not provided by this foundation.

The owner must approve concrete CI/CD and Auth/RLS results before integration/application. Hosted preview content stays read-only. No hosted write-denial probes are authorized by this document.
