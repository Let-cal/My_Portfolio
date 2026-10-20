# Contributing

This personal portfolio is maintained by Lê Trần Cát Lâm. Focused bug reports, accessibility improvements, documentation corrections, and reproducible performance findings are welcome. Issues and pull requests may be written in English or Japanese.

## Scope

Read the [README](README.md), [design specification](docs/superpowers/specs/2026-10-13-portfolio-koi-redesign-design.md), and [repository maintenance record](docs/repository-maintenance.md). Open an issue before substantial UI, animation, architecture, or dependency changes so the scope can be agreed first.

Keep professional content factual and supported by an owner-reviewed source. Database provisioning, policies, authentication, and admin CRUD are planned separately; the existing read adapter and guard stub are not completed access control. Report vulnerabilities through [SECURITY.md](SECURITY.md).

## Development and checks

Use Node.js 22.19 or newer within 22.x and npm. The frontend needs no environment file or external account.

```sh
npm ci
npm run dev
```

Work on a focused branch from the intended base. Follow `.editorconfig` and Prettier (`npm run format`), and preserve the lockfile. `npm ci` installs a pre-push hook that runs `npm run verify:quick` (formatting, lint, generated files, types; about 30 seconds). Before opening a pull request, run the same checks CI runs and record the actual results:

```sh
npm run verify            # format check, lint, generated files, types, unit tests, build, bundle and script budgets
npm audit --omit=dev --audit-level=high
```

Formatting-only commits are listed in `.git-blame-ignore-revs`; run `git config blame.ignoreRevsFile .git-blame-ignore-revs` once so local `git blame` skips them.

Install Chromium with `npx --no-install playwright install chromium` (add `--with-deps` on Linux), then run `npm run test:e2e -- --workers=1`. Playwright builds and serves production on port 3100, or reuses an existing server there outside CI. Confirm that any reused server matches the revision under review.

For performance work, follow the two-terminal setup in the [README](README.md). Preserve three runs per locale, thresholds, assertions, and frame-sampling loops. Record the revision, Lighthouse version, environment, and measurements. Avoid competing heavy workloads. A small documentation correction needs link and command validation, not a browser run.

## Pull requests

Explain the problem, resulting behavior, and validation. For visual changes, provide before/after captures with locale, role, theme, viewport, and motion preference. For interaction changes, check keyboard access, touch, reduced motion, resizing, and the static fallback where relevant.

Preserve the approved UI and animation unless a change is agreed. Keep third-party notices. Exclude secrets, private source photos, unreviewed traces, and unrelated personal data. Do not alter CV details without the owner's review. Update both READMEs where applicable and distinguish implemented behavior from planned features. State checks not run or still failing; workflow configuration alone is not evidence of passing CI.

PRs target `main`. Required checks and review conversations must be resolved before the maintainer merges. See the [maintenance record](docs/repository-maintenance.md) for verified protection settings and the [release procedure](docs/ci-release.md) for delivery. A merge can trigger Vercel; a code contribution does not authorize separate publication or settings changes.

## Reuse

No repository-wide license is currently supplied. This document grants no additional reuse rights. Third-party terms remain applicable; personal portraits, CVs, and brand assets are not reusable template content. Discuss intended reuse with the maintainer.
