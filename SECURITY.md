# Security policy

## Private vulnerability reports

Use [GitHub private vulnerability reporting](https://github.com/Let-cal/My_Portfolio/security/advisories/new), enabled and verified in the [repository maintenance record](docs/repository-maintenance.md). If you cannot use that channel, email [letcal2003@gmail.com](mailto:letcal2003@gmail.com) with the subject `Security report: My_Portfolio`. English and Japanese reports are welcome.

Include the affected URL or revision, reproducible steps, expected impact, and a minimal proof of concept. Remove credentials and unrelated personal data from logs or screenshots. Do not post exploit details, tokens, or private data in a public issue or PR. Coordinate disclosure with the maintainer after a fix or mitigation has been assessed. No response deadline, bounty, or service-level agreement is promised.

## Current scope

The public site and the admin are in scope: Next.js on Vercel, Supabase Auth, Postgres row level security, Storage and Realtime. Row level security is the authentication boundary; the proxy and server actions are defense in depth. The access model, including the read-only reviewer, is described in [docs/security/reviewer-access.md](docs/security/reviewer-access.md) and [ADR-0004](docs/adr/0004-rls-as-the-final-guard.md). Without Supabase configured, the site falls back to seed content and the admin is unavailable.

Known residual risk: the admin signs in with the same address as the public contact email, so the login name is not secret. Protection rests on the password, Supabase Auth rate limits and row level security. A separate login address or multi-factor authentication would reduce this risk; neither is in place yet.

There is no versioned support schedule. Include the revision in reports about `main`, a deployed site, or an active candidate, because these can differ. Support for historical snapshots is not promised.

## Credentials and public assets

- Never commit service-role keys, session tokens, real environment files, or private input photos. Never expose `SUPABASE_SERVICE_ROLE_KEY` through `NEXT_PUBLIC_` variables.
- Everything under `public/` is accessible even without a page link. Public CVs are intentional portfolio assets; that does not authorize publishing other personal material.
- Removing a file from deployment does not remove Git history. Report suspected credential exposure privately so rotation and history remediation can be assessed.
- Review browser traces and Lighthouse assets before sharing; they may include page content, URLs, and network details.

## Automated checks

The repository defines Gitleaks history scanning, a production dependency audit, and CodeQL analysis. The maintenance record lists verified GitHub security settings. These checks reduce risk but do not certify the absence of vulnerabilities. Workflow presence and successful artifact upload are not equivalent to a clean review. See the [CI procedure](docs/ci-release.md).

## 日本語での報告

脆弱性の疑いがある場合は、上記のGitHub非公開報告フォーム、またはメールでご連絡ください。対象URLまたはリビジョン、再現手順、想定される影響を記載し、認証情報や不要な個人情報は取り除いてください。公開Issueへの詳細な手順や機密情報の投稿はお控えください。修正内容を確認したうえで、公開時期をご相談します。
