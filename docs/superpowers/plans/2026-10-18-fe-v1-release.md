# FE v1 release implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this approved release adjustment and delivery sequence.

**Goal:** Release the reviewed FE using the owner's approved bounded mobile performance exception.

**Architecture:** Keep the existing required check names and branch protection. Select the approved 4000 ms LCP / 300 ms TBT policy only for the reviewed application content fingerprint until 2026-10-25 23:59:59 Asia/Ho_Chi_Minh; otherwise enforce the original policy. Always report original target misses alongside release failures.

**Tech stack:** Existing Node.js scripts, node:test, GitHub Actions, Next.js/Vercel Git integration.

**Spec:** `docs/fe-release-assessment.md`, approved by the owner on 2026-10-18 with “OK” in response to the explicit 4-second/300-ms proposal.

## Constraints and review focus

- Preserve P≥85, A≥95, CLS≤0.1, three-run independent medians, all functionality/security checks, no paid services, and approved UI/UX.
- Source/build-input changes or expiry restore strict budgets; the exception cannot silently carry into BE work.
- Missing/malformed metrics fail; relaxed LCP/TBT caps still fail when exceeded.
- Fingerprint includes source, public assets, dependencies, configuration and prebuild scripts; exclude only documentation, tests, GitHub metadata and explicitly named performance policy/report scripts to avoid self-reference.
- Keep original target failures visible. Merge only after every required check passes on final PR HEAD; verify actual production revision/routes and rollback target.

## Task 1: Scoped performance release policy

- [ ] Add failing node:test cases for accepted reviewed scope, exact bounds, expiry, source mismatch, changed build inputs, malformed policy, missing data and preserved original target failures.
- [ ] Implement `scripts/performance-policy.mjs`, explicit exception JSON, and optional policy input to `evaluatePerformance`.
- [ ] Resolve policy in `scripts/check-performance.mjs`; write policy metadata and original target failures to summary. Preserve default Lighthouse settings.
- [ ] Update the assessment, checkpoint and CI docs; open the performance follow-up issue.
- [ ] Run focused policy tests, artifact suite and appropriate checks; obtain fresh review; commit and push the final candidate.

## Task 2: Merge and production verification

- [ ] Update PR description with exact approval, policy scope/expiry, verification and remaining limitations.
- [ ] Wait for all seven required checks on final HEAD; fix actionable failures.
- [ ] Recheck protection, PR state, security results and rollback revision; merge through GitHub preserving history.
- [ ] Verify Vercel production Ready, exact merged revision, canonical domain, all three locale routes, quick view, PDF assets and representative browser interactions.
- [ ] Update release status/README truthfully and record final evidence without claiming original mobile targets passed.

### 2026-10-19: production transport fidelity
Ruling: measure the unchanged application through loopback HTTP/2 with streaming Brotli, matching verified Vercel transport, rather than direct Next HTTP/1.1 gzip. All locales use the same topology, default mobile emulation and approved thresholds. Decoded payload equality, real H2, streaming, error propagation and loopback isolation are checked. Preserve direct H1 results as non-gating diagnostics. This does not reproduce CDN geography/cache or guarantee a passing score; clean Windows streaming pilot remained P83. Buffered prototype results are excluded. Cost if wrong: CI-to-production transfer timing may differ; retain both raw measurements and verify public production after merge.
Validation: focused real TLS/H2 transport regression passed; actionlint and git diff --check passed; final reviewer found no remaining integration blocker. App source/fingerprint unchanged.
