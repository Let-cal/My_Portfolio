# ADR-0002: One cached content loader with a seed fallback

- Status: Accepted
- Date: 2026-10-13
- Introduced in: [PR #1](https://github.com/Let-cal/My_Portfolio/pull/1); `updateTag` on admin save added in [PR #6](https://github.com/Let-cal/My_Portfolio/pull/6)

## Context

- Public pages are read far more often than content changes, and there is one editor.
- The project runs at zero cost. A free Supabase project pauses after about seven days without requests ([design spec, section 2](../superpowers/specs/2026-10-13-portfolio-koi-redesign-design.md)).
- The site had to build and run before any database existed, and contributors should not need credentials to work on the frontend.
- An admin save must reach visitors without a redeploy.

## Decision

- Server Components read content only through `getContent()` in `src/lib/data/get-content.ts`.
- The anonymous read runs inside a `"use cache"` scope tagged `content` (Next.js 16 Cache Components, `cacheComponents: true` in `next.config.ts`).
- Every admin write calls `updateTag("content")`, then `refresh()` so the admin screens also re-render (`adminWrite` in `src/app/admin/actions.ts`).
- The loader reports one of three sources:
  - `seed-unconfigured`: no `NEXT_PUBLIC_SUPABASE_URL`, so `src/content/seed.json` is used.
  - `seed-fallback`: Supabase threw or returned data that fails `contentSchema`; the seed is used and a warning is logged.
  - `supabase`: valid data.
- A `seed-fallback` result is cached with the `minutes` profile, so the site recovers soon after Supabase returns. Other results use `max`.
- The anonymous cache never sees cookies or admin data. Draft preview is a separate request-scoped path (see [ADR-0009](0009-draft-preview-outside-the-public-cache.md)).

## Consequences

Positive:

- `npm ci && npm run dev` works with no environment file, database or account.
- A paused or broken database degrades to the committed seed instead of an error page.
- Invalid rows never reach the renderer, because the schema check runs before caching.
- Saves are visible on the next request without a rebuild.

Negative / trade-offs:

- During a fallback, visitors see the seed, which can be older than the database. Only a server log warning reports it.
- The seed must stay a valid, honest copy of the content; it is reviewed like code.
- One tag covers all content, so any save invalidates every page. That is acceptable for one editor and a small site.

## Evidence

- Loader: [src/lib/data/get-content.ts](../../src/lib/data/get-content.ts), repositories in [src/lib/data/](../../src/lib/data)
- Writes: [src/app/admin/actions.ts](../../src/app/admin/actions.ts)
- Tests: [tests/unit/get-content.test.ts](../../tests/unit/get-content.test.ts) (each source and fallback path), [tests/unit/get-content-cache.test.ts](../../tests/unit/get-content-cache.test.ts) (tag and cache lifetime), [tests/unit/admin-actions.test.ts](../../tests/unit/admin-actions.test.ts)
- Keep-alive read for the free project: [.github/workflows/supabase-keepalive.yml](../../.github/workflows/supabase-keepalive.yml)
