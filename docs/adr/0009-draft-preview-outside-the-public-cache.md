# ADR-0009: Draft preview of hidden content stays outside the public cache

- Status: Accepted
- Date: 2026-10-21
- Introduced in: [PR #14](https://github.com/Let-cal/My_Portfolio/pull/14)

## Context

The admin wanted to see a saved but hidden experience, project or certificate on the real portfolio layout before publishing it. Public content is cached in one anonymous `"use cache"` entry ([ADR-0002](0002-cached-content-loader-with-seed-fallback.md)). If hidden rows or session-dependent data ever entered that entry, every visitor would see them.

## Decision

- `/admin/preview` accepts only supported locales and local section/item anchors, checks the admin session, then enables Next.js Draft Mode.
- `getContent()` first calls `getPreviewContent()`. It returns content only when Draft Mode is on **and** `requireAdmin()` passes on this request; otherwise the anonymous cached path runs.
- Preview reads use the admin's cookie-bound Supabase client inside `React.cache`, which is request scoped. Nothing from this path is written to the `"use cache"` entry.
- Hidden rows are shown by a render-only copy with `published: true`; database flags are never changed.
- Authorized preview pages are `noindex, nofollow`. Exit is a same-origin POST that clears the draft cookie.
- An expired or non-admin session falls back to public data. A preview read failure is reported, not silently replaced with the seed.

## Consequences

Positive:

- A copied draft cookie alone reveals nothing: authorization is checked on every preview render.
- The anonymous cache entry never depends on cookies.
- The preview uses the real components, locales and layout.

Negative / trade-offs:

- Preview requests are uncached and hit Supabase each time.
- Preview shows only saved content; unsaved edits are not included.
- A real signed-in walkthrough on a deployment is a manual check; unit tests mock the session.

## Evidence

- Code: [src/lib/data/preview-content.ts](../../src/lib/data/preview-content.ts), [src/lib/data/get-content.ts](../../src/lib/data/get-content.ts), [src/app/admin/preview/route.ts](../../src/app/admin/preview/route.ts), [src/lib/admin/preview.ts](../../src/lib/admin/preview.ts)
- Tests: [tests/unit/admin-preview.test.ts](../../tests/unit/admin-preview.test.ts)
- Guide and checklist: [docs/admin-preview.md](../admin-preview.md)
