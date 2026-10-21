# Admin batch 4: preview and translation progress

> **For agentic workers:** Use superpowers:executing-plans to implement the approved spec.

**Goal:** Complete E1/E2; retain the already implemented E3/E4.
**Spec:** docs/superpowers/specs/2026-10-19-admin-ux-design.md, section 4, Batch 4.
**Architecture:** Keep anonymous content in a dedicated use-cache function. Read draftMode outside that cache; authenticate every draft request before an uncached session-client read. Request-scoped React cache deduplicates preview checks, never caches across users. No fallback to seed on preview read errors. Preview banner and content use the same authorization result. Public and unauthorized draft cookies see published content only.
**Tech stack:** Existing Next16/React19/Supabase/Tailwind/Vitest; no new dependencies or database changes.

## Constraints and review focus
- Branch feat/admin-preview-translations starts from merged PR13 abe4015. Preserve .lcp-probe.tmp.mjs and existing processes.
- Draft cookie alone never grants access. Enable requires requireAdmin, locale/anchor allowlists, no open redirects. Exit is a same-origin POST with a safe destination and no-store response.
- Anonymous content keeps content cache tag/lifetimes; no cookies or admin clients enter its cache scope. Build must retain public prerenders.
- Progress reuses translationStats; empty/nontranslated items do not create misleading fractions. E3 copy only fills empty destinations; E4 locale preference and hidden-error behavior are already covered by i18n-field tests.
- Test with fakes and readonly browser requests, not real production rows. No schema migration.

## Task 1: Private preview
- [x] Add failing route/content authorization and cache-isolation tests.
- [x] Implement safe preview helpers, GET admin enable and POST exit routes, request-scoped preview loader and banner. Add links from saved editors.
- [x] Verify focused tests, build/public cache behavior, anonymous route redirects.

## Task 2: Translation progress
- [x] Add failing list/form progress tests using shared translationStats; retain all existing copy/mode tests.
- [x] Implement compact accessible EN/JA/VI progress in lists and live editor values.
- [x] Run npm run verify and focused browser tests; independent review; fix important findings; commit and open one PR for this batch. Owner reviews preview before merge, then batch5 media.

## Rulings
- E3/E4 already exist in I18nField and ResourceForm with tests. Reuse them rather than duplicate.
- Expired/non-admin draft cookies degrade to normal published reads; unauthorized preview entry is still rejected. This prevents a stale preview cookie breaking the public page after logout.

## Verified implementation checkpoint

- `npm run verify`: 114 files / 1222 unit/component tests, formatting, lint (one pre-existing React Hook Form warning), generated assets, typecheck, production build, initial-JS budgets and 50 artifact checks pass.
- Production-build Playwright: 10 admin/metadata tests pass. A separate nine-request HTTP probe confirms all three locales remain prerendered; ordinary requests retain shared cache headers, a valid build draft cookie without admin authentication receives private no-store public content with no preview banner, and the following ordinary request remains public/cacheable.
- Independent review identified the repeated published filters. Fixed through request-local cloned preview models and tested hidden-row rendering/order and unchanged original flags. Optional JA/VI omissions are now counted as untranslated by the shared health counter, covered RED to GREEN.
- Browser testing found same-origin exit incorrectly rejected behind the local server origin. Added a reverse-proxy regression; validate the browser Host/protocol and return safe relative Location headers. Cross-origin exit remains rejected.
- Authorized preview metadata is noindex/nofollow. No dependencies, database changes or real content writes were introduced.
- Real authenticated preview/exit with a hidden test-item remains in the PR manual checklist; mocked unit tests are not represented as that check.
- Implementation is ready for a separate batch-4 PR. Merge/production review is owner-controlled before batch5.
