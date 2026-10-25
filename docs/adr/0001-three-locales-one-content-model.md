# ADR-0001: Three locales with one content model

- Status: Accepted
- Date: 2026-10-13
- Introduced in: [PR #1](https://github.com/Let-cal/My_Portfolio/pull/1); translation progress added in [PR #14](https://github.com/Let-cal/My_Portfolio/pull/14)

## Context

The portfolio is read in English, Japanese and Vietnamese. Two kinds of text exist:

- **Interface text** (navigation, headings, labels) changes only with code.
- **Content** (profile, experience, projects, skills, certificates) changes through the admin, and one item must stay one item in every language.

Separate rows or tables per locale would let the three versions of an item drift apart, and every new field would have to be added three times.

## Decision

- Routes always carry the locale: `/en`, `/ja`, `/vi` (`localePrefix: "always"` in `src/i18n/routing.ts`).
- Interface text lives in `src/messages/{en,ja,vi}.json`, served by next-intl with build-time message precompilation (`next.config.ts`).
- Content uses one record per item. Each translatable field is an `{ en, ja?, vi? }` object (`i18nText` in `src/content/schema.ts`), stored as a `jsonb` column in Postgres. English is required; Japanese and Vietnamese are optional.
- Rendering picks the visitor's locale and falls back to English when a translation is empty (`pickLocale` in `src/lib/i18n-text.ts`).
- The same Zod schema validates the seed, Supabase rows and admin forms.
- The admin shows filled-field counts per locale. "Copy from EN" only fills empty fields and never calls a translation service ([docs/admin-preview.md](../admin-preview.md)).

## Consequences

Positive:

- Adding or fixing a translation is a normal content edit, not a schema change.
- One item has one ID, one publish flag and one history across all languages.
- A test fails when a message bundle is missing a key or has an empty value.

Negative / trade-offs:

- The English fallback hides a missing translation from visitors. The admin counts are the only signal.
- The counts measure filled fields, not translation quality.
- A fourth locale touches `LOCALES` (`src/content/constants.ts`), routing, message bundles, `next.config.ts` and admin forms.

## Evidence

- Schema and fallback: [src/content/schema.ts](../../src/content/schema.ts), [src/lib/i18n-text.ts](../../src/lib/i18n-text.ts)
- Routing and messages: [src/i18n/routing.ts](../../src/i18n/routing.ts), [next.config.ts](../../next.config.ts), [src/messages/](../../src/messages)
- Storage: `jsonb` text columns in [supabase/migrations/20261018185208_init.sql](../../supabase/migrations/20261018185208_init.sql)
- Tests: [tests/unit/messages.test.ts](../../tests/unit/messages.test.ts) (same keys, no empty values), [tests/unit/i18n-text.test.ts](../../tests/unit/i18n-text.test.ts), [tests/unit/translation-progress.test.tsx](../../tests/unit/translation-progress.test.tsx)
