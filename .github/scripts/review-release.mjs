import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const statuses = new Set(["passed", "failed", "skipped", "pending", "blocked"]);
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const boolean = (value) => typeof value === "boolean";
const timestamp = (value) => Number.isSafeInteger(value) && value >= 0;
const sha = (value) =>
  typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const label = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  value === value.trim() &&
  !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
const revision = (value) =>
  record(value) && sha(value.headSha) && sha(value.baseSha);
const unique = (values) => new Set(values).size === values.length;
const baseline = [
  "desktop",
  "mobile",
  "locale-en",
  "locale-ja",
  "locale-vi",
  "theme-light",
  "theme-dark",
  "keyboard",
  "reduced-motion",
];

function safeUrl(value) {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    /[\s\u0000-\u001f\u007f-\u009f]/u.test(value)
  )
    return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

// This validates the small v1 JSON contract, not provenance or external policy.
// Reasons use only fixed labels/indexes; never echo evidence, URLs or exceptions.
function malformed(e) {
  if (!record(e) || e.version !== 1)
    return "Evidence must use the v1 object schema.";
  const p = e.policy;
  if (
    !record(p) ||
    !boolean(p.sensitive) ||
    !timestamp(p.now) ||
    !Number.isSafeInteger(p.maxReviewAgeMs) ||
    p.maxReviewAgeMs <= 0 ||
    !Number.isSafeInteger(p.maxEvidenceAgeMs) ||
    p.maxEvidenceAgeMs <= 0
  ) {
    return "Trusted policy or review freshness bounds are malformed.";
  }
  if (
    !revision(p.resolution) ||
    !timestamp(p.resolution.observedAt) ||
    !label(p.resolution.reference)
  )
    return "Trusted policy resolution must bind a revision, time and resolver reference.";
  if (
    !Array.isArray(p.requiredChecks) ||
    p.requiredChecks.length === 0 ||
    !p.requiredChecks.every(label) ||
    !unique(p.requiredChecks)
  ) {
    return "Trusted required check names must be nonempty and unique.";
  }
  if (
    !Array.isArray(p.requiredChecklist) ||
    p.requiredChecklist.length === 0 ||
    !p.requiredChecklist.every(
      (item) => record(item) && label(item.id) && boolean(item.authenticated),
    ) ||
    !unique(p.requiredChecklist.map((item) => item.id))
  ) {
    return "Trusted required checklist IDs and authentication flags are malformed.";
  }
  if (
    !Array.isArray(p.optionalChecks) ||
    !p.optionalChecks.every(
      (item) =>
        record(item) &&
        label(item.name) &&
        boolean(item.applicable) &&
        label(item.reason),
    ) ||
    !unique([...p.requiredChecks, ...p.optionalChecks.map((item) => item.name)])
  ) {
    return "Trusted optional check decisions are malformed, duplicated or overlap required checks.";
  }
  if (
    !Array.isArray(p.optionalChecklist) ||
    !p.optionalChecklist.every(
      (item) =>
        record(item) &&
        label(item.id) &&
        boolean(item.authenticated) &&
        boolean(item.applicable) &&
        label(item.reason),
    ) ||
    !unique([
      ...p.requiredChecklist.map((item) => item.id),
      ...p.optionalChecklist.map((item) => item.id),
    ])
  ) {
    return "Trusted optional checklist decisions are malformed, duplicated or overlap required items.";
  }
  if (!revision(e.reviewed) || !revision(e.current))
    return "Reviewed/current head and base must be full lowercase Git SHAs.";
  const i = e.inventory;
  if (
    !revision(i) ||
    !timestamp(i.observedAt) ||
    !boolean(i.complete) ||
    !Array.isArray(i.names) ||
    i.names.length === 0 ||
    !i.names.every(label) ||
    !unique(i.names)
  ) {
    return "Check inventory requires a revision, time, completeness flag and nonempty unique names.";
  }
  const d = e.deployment;
  if (
    !record(d) ||
    !sha(d.sha) ||
    !timestamp(d.observedAt) ||
    !boolean(d.immutable) ||
    !safeUrl(d.url) ||
    !["ready", "pending", "failed", "blocked"].includes(d.status)
  ) {
    return "Deployment SHA, status, immutable flag or sanitized HTTPS URL is malformed.";
  }
  const a = d.aliasVerification;
  if (
    a !== undefined &&
    a !== null &&
    (!record(a) ||
      !safeUrl(a.url) ||
      !label(a.deploymentId) ||
      !sha(a.sha) ||
      !timestamp(a.verifiedBefore) ||
      !timestamp(a.verifiedAfter))
  ) {
    return "Alias verification must be null or contain a sanitized HTTPS URL, deployment ID, SHA and verification times.";
  }
  if (
    !Array.isArray(e.checks) ||
    !e.checks.every(
      (check) =>
        revision(check) &&
        timestamp(check.observedAt) &&
        label(check.name) &&
        statuses.has(check.status) &&
        boolean(check.flaky) &&
        Array.isArray(check.attempts) &&
        check.attempts.length > 0 &&
        check.attempts.every((s) => statuses.has(s)),
    )
  ) {
    return "Check records require revision, name, status, flaky flag and complete attempt statuses.";
  }
  if (!unique(e.checks.map((check) => check.name)))
    return "Duplicate observed check names are ambiguous.";
  const v = e.preview;
  if (
    !revision(v) ||
    !timestamp(v.observedAt) ||
    !sha(v.deploymentSha) ||
    !safeUrl(v.deploymentUrl) ||
    !boolean(v.readOnly) ||
    !Array.isArray(v.results) ||
    !v.results.every(
      (item) =>
        record(item) &&
        label(item.id) &&
        statuses.has(item.status) &&
        boolean(item.authenticated),
    )
  ) {
    return "Preview revision, deployment, read-only flag or checklist observations are malformed.";
  }
  if (!unique(v.results.map((item) => item.id)))
    return "Duplicate observed checklist IDs are ambiguous.";
  const r = e.review;
  if (
    !revision(r) ||
    !timestamp(r.reviewedAt) ||
    !boolean(r.independent) ||
    !statuses.has(r.status) ||
    !Array.isArray(r.findings) ||
    !r.findings.every(
      (finding) =>
        record(finding) &&
        ["critical", "important", "minor"].includes(finding.severity) &&
        boolean(finding.resolved),
    )
  ) {
    return "Independent review revision, time, status or findings are malformed.";
  }
  if (!boolean(e.flaky))
    return "Global flaky state must be an explicit boolean.";
  if (
    e.approval !== null &&
    (!revision(e.approval) ||
      !boolean(e.approval.explicitOwnerApproval) ||
      !label(e.approval.scope) ||
      !label(e.approval.reference))
  ) {
    return "Approval must be null or contain a revision, explicit owner approval flag, concrete scope and owner instruction reference.";
  }
  return null;
}

/**
 * Conservative helper over agent-gathered JSON evidence. See the runbook for v1.
 * PASS is neither cryptographic attestation, GitHub approval nor merge authority.
 * No clock, mutation, external lookup, credential use or release action occurs.
 */
export function evaluateRelease(evidence) {
  const invalid = malformed(evidence);
  if (invalid) return { decision: "FAIL", reasons: [invalid] };
  const e = evidence;
  const failures = [];
  const blockers = [];
  const fail = (reason) => failures.push(reason);
  const block = (reason) => blockers.push(reason);
  const sameRevision = (value) =>
    value.headSha === e.current.headSha && value.baseSha === e.current.baseSha;
  const fresh = (observedAt, context) => {
    if (
      observedAt > e.policy.now ||
      e.policy.now - observedAt > e.policy.maxEvidenceAgeMs
    ) {
      fail(`${context} evidence is stale or dated in the future.`);
    }
  };
  const outcome = (status, context, skipAllowed = false) => {
    if (status === "failed" || (status === "skipped" && !skipAllowed))
      fail(`${context} failed or was skipped.`);
    if (status === "pending" || status === "blocked")
      block(`${context} is pending or blocked.`);
  };

  if (!sameRevision(e.reviewed))
    fail("Reviewed head/base no longer matches current head/base.");
  if (!sameRevision(e.policy.resolution))
    fail("Trusted policy resolution is for a different head/base.");
  fresh(e.policy.resolution.observedAt, "Policy resolution");
  if (!sameRevision(e.inventory))
    fail("Check inventory is for a different head/base.");
  fresh(e.inventory.observedAt, "Check inventory");
  if (!e.inventory.complete) block("Check inventory is incomplete.");
  fresh(e.deployment.observedAt, "Deployment");
  fresh(e.preview.observedAt, "Preview");
  if (e.deployment.sha !== e.current.headSha)
    fail("Deployment SHA does not match current head.");
  const alias = e.deployment.aliasVerification;
  if (!e.deployment.immutable && alias === undefined)
    fail("Deployment URL is not confirmed immutable.");
  if (!e.deployment.immutable && alias === null)
    block("Branch alias verification is missing.");
  if (!e.deployment.immutable && record(alias)) {
    fresh(alias.verifiedBefore, "Alias verification");
    fresh(alias.verifiedAfter, "Alias verification");
    if (
      alias.sha !== e.current.headSha ||
      alias.url !== e.preview.deploymentUrl
    )
      fail("Branch alias verification is for a different SHA or URL.");
    if (
      alias.verifiedBefore > e.preview.observedAt ||
      e.preview.observedAt > alias.verifiedAfter
    )
      fail("Preview checks were not bracketed by alias verification.");
  }
  if (e.deployment.status === "failed") fail("Deployment failed.");
  if (e.deployment.status !== "ready" && e.deployment.status !== "failed")
    block("Deployment is not ready.");
  if (e.flaky) fail("Unresolved flaky evidence is present.");

  const optionalCheck = (name) =>
    e.policy.optionalChecks.find((item) => item.name === name);
  e.inventory.names.forEach((name, index) => {
    if (!e.policy.requiredChecks.includes(name) && !optionalCheck(name))
      block(`Inventory check ${index + 1} is unclassified.`);
  });
  e.policy.requiredChecks.forEach((name, index) => {
    if (!e.inventory.names.includes(name))
      fail(`Required check ${index + 1} is absent from the inventory.`);
    if (!e.checks.some((check) => check.name === name))
      block(`Required check ${index + 1} is missing.`);
  });
  e.policy.optionalChecks.forEach((item, index) => {
    if (item.applicable && !e.checks.some((check) => check.name === item.name))
      block(`Applicable optional check ${index + 1} is missing.`);
  });
  e.checks.forEach((check, index) => {
    const context = `Check ${index + 1}`;
    const retries = check.attempts.slice(0, -1);
    fresh(check.observedAt, context);
    if (!sameRevision(check)) fail(`${context} is for a different head/base.`);
    if (!e.inventory.names.includes(check.name))
      fail(`${context} is absent from the inventory.`);
    if (check.status !== check.attempts.at(-1))
      fail(`${context} status disagrees with its final attempt.`);
    if (check.flaky || retries.some((s) => s === "failed" || s === "skipped")) {
      fail(`${context} has flaky, failed or skipped attempt history.`);
    }
    retries.forEach((status) => outcome(status, `${context} attempt`));
    outcome(
      check.status,
      context,
      optionalCheck(check.name)?.applicable === false,
    );
  });

  if (
    !sameRevision(e.preview) ||
    e.preview.deploymentSha !== e.deployment.sha ||
    e.preview.deploymentUrl !== e.deployment.url
  )
    fail("Preview evidence is for a different revision or deployment URL.");
  if (!e.preview.readOnly)
    fail("Hosted preview content checks were not read-only.");
  if (
    !baseline.every((id) =>
      e.policy.requiredChecklist.some((item) => item.id === id),
    )
  )
    fail("Trusted required checklist omits the baseline matrix.");
  [
    ...e.policy.requiredChecklist,
    ...e.policy.optionalChecklist.filter((item) => item.applicable),
  ].forEach((required, index) => {
    const result = e.preview.results.find((item) => item.id === required.id);
    if (!result) block(`Required checklist item ${index + 1} is missing.`);
    else if (required.authenticated && !result.authenticated)
      block(
        `Required checklist item ${index + 1} lacks authenticated preview evidence.`,
      );
  });
  e.preview.results.forEach((result, index) => {
    const context = `Checklist item ${index + 1}`;
    const optional = e.policy.optionalChecklist.find(
      (item) => item.id === result.id,
    );
    if (
      !optional &&
      !e.policy.requiredChecklist.some((item) => item.id === result.id)
    )
      fail(`${context} is unclassified.`);
    outcome(result.status, context, optional?.applicable === false);
  });

  if (!sameRevision(e.review))
    fail("Independent review is for a different head/base.");
  if (!e.review.independent) block("Fresh independent review is required.");
  if (
    e.review.reviewedAt > e.policy.now ||
    e.policy.now - e.review.reviewedAt > e.policy.maxReviewAgeMs
  ) {
    fail("Independent review is stale or dated in the future.");
  }
  outcome(e.review.status, "Independent review");
  if (
    e.review.findings.some(
      (finding) => !finding.resolved && finding.severity !== "minor",
    )
  ) {
    fail("Independent review has unresolved important or critical findings.");
  }
  if (e.approval !== null && !sameRevision(e.approval))
    fail("Owner approval is for a different head/base.");
  if (e.policy.sensitive && e.approval?.explicitOwnerApproval !== true)
    block(
      "Sensitive change requires explicit owner approval of this head/base.",
    );

  return {
    decision: failures.length ? "FAIL" : blockers.length ? "BLOCKED" : "PASS",
    reasons: [...new Set([...failures, ...blockers])],
  };
}

// CLI only reads one local JSON file and prints the sanitized decision.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let result;
  const args = process.argv.slice(2);
  if (
    args.length !== 1 ||
    !args[0] ||
    args[0].startsWith("-") ||
    /[a-z][a-z0-9+.-]*:\/\//iu.test(args[0])
  ) {
    result = {
      decision: "FAIL",
      reasons: [
        "Usage: node .github/scripts/review-release.mjs LOCAL_EVIDENCE.json",
      ],
    };
  } else {
    try {
      result = evaluateRelease(JSON.parse(readFileSync(args[0], "utf8")));
    } catch {
      result = {
        decision: "FAIL",
        reasons: ["Unable to read or parse local evidence JSON."],
      };
    }
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.decision === "PASS" ? 0 : 1;
}
