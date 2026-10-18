# FE v1 release assessment — 2026-10-18

**Decision status: approved by the owner on 2026-10-18.** The owner answered “OK” to the explicit FE v1 LCP≤4-second/TBT≤300-ms proposal. Implementation retains the existing required check names and branch protection.

## Product objective

The portfolio primarily serves recruiters reviewing the developer's work on desktop: readable experience and project evidence, an identifiable Japanese-inspired 3D story, deliberate animation, responsive behavior and traceable engineering practice. Mobile remains a supported path to the same content, CV and contact details. A two-day optimization loop has delayed making that work available.

The current [checkpoint](fe-release-checkpoint.md) separates passing functional/security checks from remaining lab loading budgets. Candidate `9317fc9` is not released.

## What the evidence means

The deployed English candidate's desktop three-run medians are P99, LCP694 ms and TBT20 ms. Its mobile medians are P91, LCP3224 ms and TBT114 ms. CI across all three languages has LCP3165–3318 ms, with English TBT239 ms. This supports a real loading-performance improvement opportunity on a constrained mobile profile. It does not show that the site is unusable on phones, nor that all desktop devices are fast.

Google defines good field LCP as at most 2.5 seconds and evaluates Core Web Vitals at the 75th percentile, segmented by device. The 2.5–4 second range needs improvement. A three-run lab median is not that field distribution. TBT is a lab proxy, not field INP. Automated Accessibility 100 does not establish complete accessibility compliance.

Research examined Adham Dannaway's design portfolio, Brittany Chiang's engineering portfolio and Bruno Simon's 3D portfolio with quality controls. Their approaches demonstrate different product priorities, not a universal release score. Other portfolios missing a lab target cannot establish acceptable performance for this project. Cross-site delivery paths, content and latency differ; comparison results are diagnostic context, not a ranking or evidence of recruiting outcomes.

## Options

| Option | Effect | Assessment |
| --- | --- | --- |
| Keep every current budget as a hard first-release gate | Continue until every locale meets LCP2500/TBT200; no reliable completion date | Appropriate if those budgets are binding; disproportionate to the clarified goal without a new proven optimization |
| Explicit bounded FE v1 exception | Release after functional, security and broader performance safeguards pass; retain original targets as documented debt | **Recommended**, subject to owner approval and final verification |
| Replace the mobile entry with quick view | Redesign mobile routing/presentation, then verify the new entry | More product change and regression risk; not the fastest way to preserve the approved experience |

## Approved bounded exception

- Preserve all required lint/type/unit/browser/build/bundle/security and Vercel checks.
- Retain three runs per locale and measurement failure reporting. Keep P≥85, Accessibility≥95 and CLS≤0.1. For **FE v1 only**, accept mobile median LCP≤4000 ms and TBT≤300 ms. These are proposed release tolerances, **not new definitions of good Core Web Vitals**.
- Retain LCP≤2500 ms and TBT≤200 ms as optimization targets and report whether they are missed. Do not mark original targets passed or silently bypass a failed job.
- Encode an approved exception visibly, scoped to the reviewed FE application revision, with an expiry or explicit follow-up decision. A later application revision must not inherit it silently. CI changes must still be reviewed and checked.
- Check desktop and phone recruiter journeys: readable content, role selection, correct PDF retrieval, section/locale navigation, case-study dismissal, quick view, accessible contact, no horizontal overflow and motion preferences. A broken core journey blocks release regardless of performance score.
- Record the lack of physical Android/iPhone Safari verification; emulation cannot remove that uncertainty. Do not claim universal device support from Chromium tests.
- Open a focused performance follow-up, retain the previous production revision as rollback target, and verify the merged revision and public routes after deployment. No paid service or automatic follow-up is included.

## Recommendation

This makes the product trade-off reviewable, preserves the approved UI/UX, and avoids a speculative framework or mobile-layout rewrite. The approved policy is recorded in `scripts/fe-v1-performance-exception.json`, scoped to reviewed application/build content at `56d9889`, and expires at 2026-10-25 23:59:59 Asia/Ho_Chi_Minh. This incorporates necessary asset-generator security fixes and immutable build assets after `9317fc9`. Production builds verify committed images rather than re-encoding them differently on each platform; manual regeneration remains available through `npm run generate:assets`. No committed artwork was changed. Changed application/build inputs restore strict budgets. [Issue #2](https://github.com/Let-cal/My_Portfolio/issues/2) tracks the original targets. Approval does not itself establish that the new CI run passes or that production is released.

## Primary references

- [Google: Web Vitals and field measurement](https://web.dev/articles/vitals)
- [Google: lab versus field differences](https://web.dev/articles/lab-and-field-data-differences)
- [Chrome: Lighthouse performance scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)
- [Lighthouse: variability and repeated measurement](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md)
- [Google: LCP thresholds](https://web.dev/articles/lcp)
- [Adham Dannaway](https://www.adhamdannaway.com/), [Brittany Chiang](https://brittanychiang.com/), [Bruno Simon](https://bruno-simon.com/)
