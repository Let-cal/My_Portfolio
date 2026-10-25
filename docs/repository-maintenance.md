# Repository maintenance / リポジトリ運用

This document records the repository configuration verified on **2026-10-16**. GitHub settings are live account state; the files in this repository do not apply those settings automatically.

## Identity and navigation

- Repository: [Let-cal/My_Portfolio](https://github.com/Let-cal/My_Portfolio), public, default branch `main`.
- Homepage: [letcal.is-a.dev](https://letcal.is-a.dev).
- About describes the multilingual portfolio, Japanese-inspired koi-to-dragon story and implemented frontend technologies. Topics describe the source that exists, rather than planned backend functionality.
- English documentation is the entry point; `README.ja.md` provides the Japanese overview and setup instructions.
- Public visibility is not a software license. Check the rights statements and third-party notices before reusing code, photographs, CVs or artwork.

## Protected integration

`main` requires an up-to-date pull request and these exact check contexts:

1. `Lint, types, unit tests and budgets`
2. `Playwright Chromium on Linux`
3. `Lighthouse mobile (a11y, SEO and CLS gate; performance advisory)`
4. `Gitleaks full history`
5. `Production npm audit (high and critical)`
6. `Read-only JavaScript and TypeScript analysis`
7. `Vercel`

Protection applies to administrators. Force pushes and branch deletion are blocked; review conversations must be resolved. Stale approvals are dismissed. The approving-review count is zero because this is a solo-maintained project: this does **not** claim approval by another GitHub maintainer. Review findings and their resolution belong in the PR.

Use a merge commit for this frontend migration to preserve the implementation and fix history. The repository currently allows all three GitHub merge methods; choosing a method for a later PR requires reviewing that PR's history. Automatic branch deletion is off, preserving the release branch until production verification finishes.

## Security and automation

The following settings were enabled and read back through GitHub's API:

| Setting | State |
| --- | --- |
| Dependabot vulnerability alerts | Enabled |
| Dependabot security updates | Enabled |
| Secret scanning | Enabled |
| Secret scanning push protection | Enabled |
| Private vulnerability reporting | Enabled |
| Default workflow token permissions | Read only |
| Workflows can approve pull requests | Disabled |
| Actions must use full commit SHAs | Required |

Scheduled dependency updates are defined in [Dependabot configuration](../.github/dependabot.yml). Patch and minor updates, including security updates, merge on their own once every required check passes ([workflow](../.github/workflows/dependabot-auto-merge.yml)); major updates and `@playwright/test` wait for a person. CodeQL is configured in source; do not enable duplicate default setup. A scanner passing is evidence about that run, not a guarantee that the application has no vulnerabilities.

Use [private reporting](https://github.com/Let-cal/My_Portfolio/security/advisories/new) for sensitive findings. See [SECURITY.md](../SECURITY.md). Never paste credentials or personal data into public issues, logs or screenshots.

## Release and cost boundaries

The [CI procedure](ci-release.md) defines budgets, permissions and deployment verification. A ready Vercel preview does not establish that `main` or production contains that revision.

Standard public-repository GitHub runners and the existing Vercel Hobby project are used. No paid integration was provisioned. Keep retention short and reassess quotas and billing before changing repository visibility or runner type.

## References

These are operational conventions, not a claim of ISO certification or a universal Japanese standard:

- [GitHub: repository READMEs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)
- [GitHub: protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub: secret scanning](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)
- [Zenn editor](https://github.com/zenn-dev/zenn-editor), a reference for concise Japanese technical documentation; its product, code and licensing are separate from this portfolio.
