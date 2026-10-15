# Letcal — interactive developer portfolio

A personal portfolio for **Lê Trần Cát Lâm**, built around a Japanese garden and the story of a koi becoming a dragon. Three views present work and project evidence: Developer, Tech Lead and Technical PM.

**Domain:** [letcal.is-a.dev](https://letcal.is-a.dev) · **Backup:** [letcal.vercel.app](https://letcal.vercel.app)

## Frontend

- English, Japanese and Vietnamese routes with localized metadata.
- Circular role selector with portrait reveals, keyboard controls and touch gestures.
- Experience timeline, project case studies, skill-to-project evidence, certificates and contact details.
- Shared 3D koi/dragon scene: chapter cameras, lotus pond, waterfall, lanterns, day/night lighting and pointer interactions.
- System-aware motion preferences and a visitor-controlled Motion switch. Mobile, reduced motion and WebGL failures retain a static presentation.
- Command palette and printable 60-second recruiter view.
- Server-rendered content, deferred scenery construction and locally hosted assets.

The frontend runs from validated `src/content/seed.json` without a database account. A Supabase repository adapter is present; database provisioning, admin authentication and CRUD screens are the next phase, not completed frontend features.

## Stack

| Area | Tools |
| --- | --- |
| Application | Next.js App Router, React, TypeScript |
| Styling and controls | Tailwind CSS, Radix UI components |
| Localization | next-intl |
| Motion | Motion, GSAP/ScrollTrigger, Lenis |
| 3D | Three.js, React Three Fiber, Drei |
| Content | Zod, seed/Supabase repository boundary |
| Verification | Vitest, Testing Library, Playwright, axe, Lighthouse |
| Delivery | GitHub Actions, Vercel |

Exact installed versions are recorded in `package-lock.json`.

## Run locally

Use Node.js **22.19 or later in the 22.x line** and npm (the locked Lighthouse release requires it).

```sh
npm ci
npm run dev
```

Open [localhost:3000/en](http://localhost:3000/en), `/ja` or `/vi`. The seed works without `.env`. Copy `.env.example` to `.env.local` only when configuring services. Never expose `SUPABASE_SERVICE_ROLE_KEY` through a `NEXT_PUBLIC_` variable or commit real credentials.

```sh
npm run build
npm run start
```

Prebuild generates responsive portrait variants, site icons and the skill sprite. Original artwork remains under `public/images/roles`; generated AVIF portraits are served directly without a client image runtime or request-time optimization.

The `@swc/core` override is pinned to `1.16.0` for the existing Windows tooling workaround. Keep the lockfile and verify updates on Windows and Linux before removing the pin.

## Checks

```sh
npm run lint
npm test
npm run build
npx tsc --noEmit
npm run check:bundle
npm run test:budgets
npm run check:performance
npx playwright install chromium
npm run test:e2e -- --workers=2
npm audit --omit=dev --audit-level=high
```

Playwright uses a production build on **port 3100**, leaving development on port 3000 alone. Linux CI installs Chromium system dependencies and uses the renderer in `playwright.config.ts`.

Release budgets: **200 KB gzip initial JavaScript**, mobile Lighthouse Performance ≥85, Accessibility ≥95, LCP ≤2500 ms, TBT ≤200 ms and CLS ≤0.1. Build success or desktop FPS alone does not establish that these gates pass. See [CI and release flow](docs/ci-release.md).

## Structure

```text
src/app/[locale]/       Localized pages, layout and metadata
src/components/        Sections, controls and effects
src/content/           Content schema and public seed
src/lib/data/          Content repositories and caching
src/scene/             Tiers, creatures, scenery and interactions
public/                Portraits, CVs, local models and fallbacks
scripts/               Asset generation and bundle measurements
tests/                 Unit, browser and artifact checks
docs/                  Design, asset sources and release notes
```

## Design decisions and sources

- [Content surfaces and scroll stability](docs/superpowers/reports/content-surfaces-review.md)
- [Continuous day/night garden](docs/superpowers/reports/garden-day-night-review.md)
- [Obsidian night palette](docs/superpowers/reports/garden-night-palette.md)
- [Waterfall assets and provenance](docs/superpowers/reports/waterfall-environment-review.md)
- [Free domain setup](docs/domain-is-a-dev.md)

UI components live in the repository. Vendored shadcn Tailwind extensions retain their [MIT license](src/app/vendor/SHADCN-LICENSE.txt); the shadcn CLI is not an application dependency. Skill brand glyphs are from Simple Icons under CC0. The waterfall report records the other asset sources.

## Delivery

Feature branch → pull request → checks and review → `main` → Vercel production verification. The Vercel project is `letcal`; this version requires the Next.js framework preset. Verify the merged revision, public domain and routes before declaring release complete.

Workflows use standard Linux runners for the public repository and no paid scanner service. Read the CI document before changing repository visibility or billing settings.
