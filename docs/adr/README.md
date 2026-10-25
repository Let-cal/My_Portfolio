# Architecture Decision Records

Each record describes one decision that shapes this repository: the problem, what was chosen, what it costs, and where to check it in code, tests, workflows and pull requests.

Format: a lightweight [MADR](https://adr.github.io/madr/) variant with Status, Date, Context, Decision, Consequences and Evidence. The date is when the decision first appeared in `git log`. Records were written after the fact on 2026-10-25 from the code, docs and history; they describe what exists, not plans.

| ADR | Decision | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-three-locales-one-content-model.md) | Three locales with one content model | Accepted | 2026-10-13 |
| [0002](0002-cached-content-loader-with-seed-fallback.md) | One cached content loader with a seed fallback | Accepted | 2026-10-13 |
| [0003](0003-3d-scene-never-blocks-content.md) | The 3D scene never blocks content | Accepted | 2026-10-14 |
| [0004](0004-rls-as-the-final-guard.md) | Row level security is the final guard; the admin allowlist is private | Accepted | 2026-10-19 |
| [0005](0005-pragmatic-ci-gates.md) | Block on stable signals; report lab loading metrics as advisory | Accepted | 2026-10-19 |
| [0006](0006-content-history-with-triggers.md) | Content history through database triggers; restore is admin-only | Accepted | 2026-10-20 |
| [0007](0007-private-realtime-broadcast.md) | Live admin updates through a private Realtime Broadcast topic | Accepted | 2026-10-20 |
| [0008](0008-media-library-on-supabase-storage.md) | Media library on Supabase Storage with admin-only listing | Accepted | 2026-10-21 |
| [0009](0009-draft-preview-outside-the-public-cache.md) | Draft preview of hidden content stays outside the public cache | Accepted | 2026-10-21 |
| [0010](0010-disposable-supabase-integration-tests.md) | Test Auth, RLS, Storage and Realtime against a disposable local Supabase in CI | Accepted | 2026-10-22 |
| [0011](0011-fail-closed-release-evaluator.md) | A fail-closed evaluator for preview review evidence | Accepted | 2026-10-22 |
| [0012](0012-hosted-migrations-through-reviewed-sql.md) | Hosted migrations go through reviewed SQL; file names match the hosted history | Accepted | 2026-10-25 |
| [0013](0013-read-only-reviewer-role.md) | A read-only reviewer role for signed-in preview checks | Accepted | 2026-10-25 |

## Adding a record

1. Copy the structure of an existing record and take the next number.
2. Link evidence that a reader can open: files on `main`, tests, workflows, PRs. Do not cite work that is not merged as if it were; mark it Proposed and link the PR.
3. Keep account identifiers, emails and secrets out.
4. When a decision is replaced, set the old record's status to `Superseded by ADR-NNNN` instead of deleting it.

Longer design documents (mostly in Vietnamese) are in [docs/superpowers/specs/](../superpowers/specs) and [docs/superpowers/plans/](../superpowers/plans).
