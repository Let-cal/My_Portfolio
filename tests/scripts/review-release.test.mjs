import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = new URL(
  "../../.github/scripts/review-release.mjs",
  import.meta.url,
);
const release = await import(script.href).catch((error) => {
  if (error.code === "ERR_MODULE_NOT_FOUND" && error.url === script.href)
    return {};
  throw error;
});
const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);
const OTHER = "c".repeat(40);
const PREVIEW_URL = "https://portfolio-synthetic-123.vercel.app/";
const NOW = 1_792_540_800_000;
const BASELINE = [
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

// Synthetic resolver policy is deliberately separate from observed results.
function ordinary() {
  return {
    version: 1,
    policy: {
      resolution: {
        headSha: HEAD,
        baseSha: BASE,
        observedAt: NOW - 60_000,
        reference: "Synthetic trusted scope and protection review",
      },
      requiredChecks: ["quality", "browser"],
      optionalChecks: [],
      requiredChecklist: [
        ...BASELINE.map((id) => ({ id, authenticated: false })),
        { id: "changed-flow", authenticated: false },
      ],
      optionalChecklist: [],
      sensitive: false,
      now: NOW,
      maxReviewAgeMs: 3_600_000,
      maxEvidenceAgeMs: 3_600_000,
    },
    reviewed: { headSha: HEAD, baseSha: BASE },
    current: { headSha: HEAD, baseSha: BASE },
    inventory: {
      headSha: HEAD,
      baseSha: BASE,
      observedAt: NOW - 60_000,
      complete: true,
      names: ["quality", "browser"],
    },
    deployment: {
      id: "dpl_synthetic123",
      sha: HEAD,
      status: "ready",
      immutable: true,
      url: PREVIEW_URL,
      observedAt: NOW - 60_000,
    },
    checks: ["quality", "browser"].map((name) => ({
      name,
      headSha: HEAD,
      baseSha: BASE,
      status: "passed",
      attempts: ["passed"],
      flaky: false,
      observedAt: NOW - 60_000,
    })),
    preview: {
      headSha: HEAD,
      baseSha: BASE,
      deploymentSha: HEAD,
      deploymentUrl: PREVIEW_URL,
      readOnly: true,
      observedAt: NOW - 60_000,
      lastObservedAt: NOW - 60_000,
      results: [...BASELINE, "changed-flow"].map((id) => ({
        id,
        status: "passed",
        authenticated: false,
      })),
    },
    review: {
      headSha: HEAD,
      baseSha: BASE,
      reviewedAt: NOW - 60_000,
      independent: true,
      status: "passed",
      findings: [],
    },
    flaky: false,
    approval: null,
  };
}

function evaluate(evidence) {
  assert.equal(
    typeof release.evaluateRelease,
    "function",
    "export evaluateRelease",
  );
  const result = release.evaluateRelease(evidence);
  assert.deepEqual(Object.keys(result).sort(), ["decision", "reasons"]);
  assert.ok(Array.isArray(result.reasons));
  assert.ok(result.reasons.every((reason) => typeof reason === "string"));
  if (result.decision !== "PASS") assert.ok(result.reasons.length > 0);
  return result;
}

test("complete ordinary evidence returns PASS without merge authority", () => {
  assert.deepEqual(evaluate(ordinary()), { decision: "PASS", reasons: [] });
});

// Each mutation removes a concrete release condition; expectations are literals.
const cases = [
  ["moved current head", (e) => (e.current.headSha = OTHER), "FAIL"],
  ["moved current base", (e) => (e.current.baseSha = OTHER), "FAIL"],
  ["old reviewed head", (e) => (e.reviewed.headSha = OTHER), "FAIL"],
  ["old reviewed base", (e) => (e.reviewed.baseSha = OTHER), "FAIL"],
  ["wrong deployment SHA", (e) => (e.deployment.sha = OTHER), "FAIL"],
  ["mutable deployment", (e) => (e.deployment.immutable = false), "FAIL"],
  ["pending deployment", (e) => (e.deployment.status = "pending"), "BLOCKED"],
  ["failed deployment", (e) => (e.deployment.status = "failed"), "FAIL"],
  ["blocked deployment", (e) => (e.deployment.status = "blocked"), "BLOCKED"],
  ["missing check", (e) => e.checks.pop(), "BLOCKED"],
  ["empty observed checks", (e) => (e.checks = []), "BLOCKED"],
  ["duplicate check", (e) => e.checks.push({ ...e.checks[0] }), "FAIL"],
  ["stale check head", (e) => (e.checks[0].headSha = OTHER), "FAIL"],
  ["stale check base", (e) => (e.checks[0].baseSha = OTHER), "FAIL"],
  ["flaky global state", (e) => (e.flaky = true), "FAIL"],
  ["flaky check", (e) => (e.checks[0].flaky = true), "FAIL"],
  [
    "retry-only pass even when flaky is false",
    (e) => (e.checks[0].attempts = ["failed", "passed"]),
    "FAIL",
  ],
  [
    "skipped attempt hidden by final pass",
    (e) => (e.checks[0].attempts = ["skipped", "passed"]),
    "FAIL",
  ],
  [
    "inconsistent final attempt",
    (e) => (e.checks[0].attempts = ["failed"]),
    "FAIL",
  ],
  ["missing checklist result", (e) => e.preview.results.pop(), "BLOCKED"],
  ["empty checklist observations", (e) => (e.preview.results = []), "BLOCKED"],
  [
    "duplicate checklist result",
    (e) => e.preview.results.push({ ...e.preview.results[0] }),
    "FAIL",
  ],
  ["old preview head", (e) => (e.preview.headSha = OTHER), "FAIL"],
  ["old preview base", (e) => (e.preview.baseSha = OTHER), "FAIL"],
  ["old preview deployment", (e) => (e.preview.deploymentSha = OTHER), "FAIL"],
  [
    "different preview URL",
    (e) => (e.preview.deploymentUrl = "https://other.vercel.app/"),
    "FAIL",
  ],
  ["hosted write evidence", (e) => (e.preview.readOnly = false), "FAIL"],
  [
    "auth required by resolver but missing in observation",
    (e) => (e.policy.requiredChecklist[0].authenticated = true),
    "BLOCKED",
  ],
  ["nonindependent review", (e) => (e.review.independent = false), "BLOCKED"],
  ["stale review head", (e) => (e.review.headSha = OTHER), "FAIL"],
  ["stale review base", (e) => (e.review.baseSha = OTHER), "FAIL"],
  ["expired review", (e) => (e.review.reviewedAt = NOW - 3_600_001), "FAIL"],
  ["future review", (e) => (e.review.reviewedAt = NOW + 1), "FAIL"],
  [
    "unresolved important finding",
    (e) => e.review.findings.push({ severity: "important", resolved: false }),
    "FAIL",
  ],
  [
    "unresolved critical finding",
    (e) => e.review.findings.push({ severity: "critical", resolved: false }),
    "FAIL",
  ],
  ["sensitive approval absent", (e) => (e.policy.sensitive = true), "BLOCKED"],
  [
    "nonexplicit owner approval",
    (e) => {
      e.policy.sensitive = true;
      e.approval = {
        headSha: HEAD,
        baseSha: BASE,
        explicitOwnerApproval: false,
        scope: "Concrete diff",
        reference: "Synthetic owner instruction",
      };
    },
    "BLOCKED",
  ],
  [
    "owner approval for old head",
    (e) => {
      e.policy.sensitive = true;
      e.approval = {
        headSha: OTHER,
        baseSha: BASE,
        explicitOwnerApproval: true,
        scope: "Concrete diff",
        reference: "Synthetic owner instruction",
      };
    },
    "FAIL",
  ],
  [
    "owner approval for old base",
    (e) => {
      e.policy.sensitive = true;
      e.approval = {
        headSha: HEAD,
        baseSha: OTHER,
        explicitOwnerApproval: true,
        scope: "Concrete diff",
        reference: "Synthetic owner instruction",
      };
    },
    "FAIL",
  ],
  [
    "FAIL takes precedence over missing prerequisite",
    (e) => {
      e.checks.pop();
      e.flaky = true;
    },
    "FAIL",
  ],
];

for (const status of ["failed", "skipped", "pending", "blocked"]) {
  const want = ["pending", "blocked"].includes(status) ? "BLOCKED" : "FAIL";
  cases.push([
    `${status} required check`,
    (e) => {
      e.checks[0].status = status;
      e.checks[0].attempts = [status];
    },
    want,
  ]);
  cases.push([
    `${status} checklist result`,
    (e) => (e.preview.results[0].status = status),
    want,
  ]);
  cases.push([`${status} review`, (e) => (e.review.status = status), want]);
}

for (const [name, mutate, want] of cases) {
  test(`rejects ${name}`, () => {
    const evidence = ordinary();
    mutate(evidence);
    assert.equal(evaluate(evidence).decision, want);
  });
}

test("same-revision explicit sensitive approval permits PASS", () => {
  const evidence = ordinary();
  evidence.policy.sensitive = true;
  evidence.approval = {
    headSha: HEAD,
    baseSha: BASE,
    explicitOwnerApproval: true,
    scope: "Concrete diff",
    reference: "Synthetic owner instruction",
  };
  assert.equal(evaluate(evidence).decision, "PASS");
});

test("required authenticated read-only preview permits PASS", () => {
  const evidence = ordinary();
  evidence.policy.requiredChecklist[0].authenticated = true;
  evidence.preview.results[0].authenticated = true;
  assert.equal(evaluate(evidence).decision, "PASS");
});

test("resolved important and unresolved minor findings do not block", () => {
  const evidence = ordinary();
  evidence.review.findings = [
    { severity: "important", resolved: true },
    { severity: "minor", resolved: false },
  ];
  evidence.review.reviewedAt = NOW - 3_600_000;
  assert.equal(evaluate(evidence).decision, "PASS");
});

for (const value of [undefined, null, false, 0, "", [], {}, { version: 1 }]) {
  test(`malformed top-level evidence ${JSON.stringify(value)} fails closed`, () => {
    assert.equal(evaluate(value).decision, "FAIL");
  });
}

const malformed = [
  ["unknown version", (e) => (e.version = 2)],
  ["missing trusted policy", (e) => delete e.policy],
  ["empty required check names", (e) => (e.policy.requiredChecks = [])],
  ["empty required checklist IDs", (e) => (e.policy.requiredChecklist = [])],
  [
    "duplicate required check name",
    (e) => e.policy.requiredChecks.push("quality"),
  ],
  [
    "duplicate required checklist ID",
    (e) =>
      e.policy.requiredChecklist.push({ ...e.policy.requiredChecklist[0] }),
  ],
  ["nonstring check name", (e) => (e.policy.requiredChecks[0] = 123)],
  ["blank checklist ID", (e) => (e.policy.requiredChecklist[0].id = " ")],
  [
    "missing required authentication flag",
    (e) => delete e.policy.requiredChecklist[0].authenticated,
  ],
  ["string sensitive flag", (e) => (e.policy.sensitive = "false")],
  ["NaN resolver clock", (e) => (e.policy.now = NaN)],
  ["infinite review age", (e) => (e.policy.maxReviewAgeMs = Infinity)],
  ["zero review age", (e) => (e.policy.maxReviewAgeMs = 0)],
  ["negative review timestamp", (e) => (e.review.reviewedAt = -1)],
  ["missing findings", (e) => delete e.review.findings],
  [
    "unknown severity",
    (e) => e.review.findings.push({ severity: "unknown", resolved: false }),
  ],
  [
    "string finding resolution",
    (e) => e.review.findings.push({ severity: "important", resolved: "true" }),
  ],
  ["string global flaky flag", (e) => (e.flaky = "false")],
  ["string per-check flaky flag", (e) => (e.checks[0].flaky = "false")],
  ["empty attempts", (e) => (e.checks[0].attempts = [])],
  ["unknown attempt status", (e) => (e.checks[0].attempts = ["success"])],
  ["unknown check status", (e) => (e.checks[0].status = "success")],
  ["unknown deployment status", (e) => (e.deployment.status = "success")],
  ["unknown preview status", (e) => (e.preview.results[0].status = "success")],
  ["unknown review status", (e) => (e.review.status = "success")],
  [
    "string authentication observation",
    (e) => (e.preview.results[0].authenticated = "true"),
  ],
  ["string read-only flag", (e) => (e.preview.readOnly = "true")],
  ["string independent flag", (e) => (e.review.independent = "true")],
  ["string immutable flag", (e) => (e.deployment.immutable = "true")],
  [
    "malformed approval even for ordinary change",
    (e) => (e.approval = { explicitOwnerApproval: "true" }),
  ],
];

for (const [label, mutate] of malformed) {
  test(`malformed ${label} returns FAIL`, () => {
    const evidence = ordinary();
    mutate(evidence);
    assert.equal(evaluate(evidence).decision, "FAIL");
  });
}

for (const field of [
  "reviewed",
  "current",
  "deployment",
  "checks",
  "preview",
  "review",
  "flaky",
  "approval",
]) {
  test(`missing ${field} fails closed`, () => {
    const evidence = ordinary();
    delete evidence[field];
    assert.equal(evaluate(evidence).decision, "FAIL");
  });
}

for (const sha of [
  null,
  123,
  "abc123",
  "g".repeat(40),
  "a".repeat(39),
  "a".repeat(41),
  `${HEAD}\n`,
]) {
  test(`rejects invalid SHA ${JSON.stringify(sha)}`, () => {
    const evidence = ordinary();
    evidence.current.headSha = sha;
    assert.equal(evaluate(evidence).decision, "FAIL");
  });
}

for (const url of [
  null,
  123,
  "",
  "not a url",
  "http://preview.test/",
  "file:///tmp/a",
  "javascript:alert(1)",
  "https://user:password@preview.test/",
  "https://preview.test/?token=secret",
  "https://preview.test/#secret",
  "https://preview.test/\n",
]) {
  test(`rejects invalid or credential-bearing URL ${JSON.stringify(url)}`, () => {
    const evidence = ordinary();
    evidence.deployment.url = url;
    evidence.preview.deploymentUrl = url;
    const result = evaluate(evidence);
    assert.equal(result.decision, "FAIL");
    assert.doesNotMatch(
      JSON.stringify(result),
      /password|token=secret|#secret/,
    );
  });
}

test("evaluation is deterministic and does not mutate evidence", () => {
  const evidence = ordinary();
  const before = structuredClone(evidence);
  assert.deepEqual(evaluate(evidence), evaluate(evidence));
  assert.deepEqual(evidence, before);
});

function cli(args) {
  return spawnSync(process.execPath, [fileURLToPath(script), ...args], {
    encoding: "utf8",
    shell: false,
  });
}

test("local JSON CLI emits PASS/FAIL/BLOCKED and distinct nonzero rejection", () => {
  const directory = mkdtempSync(join(tmpdir(), "review-release-"));
  try {
    for (const [label, mutate, want, exit] of [
      ["ordinary", () => {}, "PASS", 0],
      ["stale", (e) => (e.current.headSha = OTHER), "FAIL", 1],
      ["missing", (e) => e.checks.pop(), "BLOCKED", 1],
    ]) {
      const evidence = ordinary();
      mutate(evidence);
      const path = join(directory, `${label}.json`);
      writeFileSync(path, JSON.stringify(evidence));
      const result = cli([path]);
      assert.equal(result.status, exit, result.stderr);
      assert.equal(JSON.parse(result.stdout).decision, want);
      assert.equal(result.stderr, "");
    }
    const malformedPath = join(directory, "bad.json");
    writeFileSync(malformedPath, '{"secret":"DO_NOT_PRINT",');
    for (const args of [
      [],
      [malformedPath],
      [malformedPath, "extra"],
      [join(directory, "never-created.json")],
      ["https://example.invalid/evidence.json"],
      ["-"],
    ]) {
      const result = cli(args);
      assert.equal(result.status, 1);
      assert.equal(JSON.parse(result.stdout).decision, "FAIL");
      assert.doesNotMatch(
        result.stdout + result.stderr,
        /DO_NOT_PRINT|example\.invalid/,
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("CLI still decides when executed through a symlinked directory", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "review-release-"));
  try {
    const linked = join(directory, "scripts");
    try {
      // "junction" needs no privilege on Windows; POSIX ignores the type.
      symlinkSync(dirname(fileURLToPath(script)), linked, "junction");
    } catch {
      t.skip("symlink or junction creation is not permitted here");
      return;
    }
    const path = join(directory, "ordinary.json");
    writeFileSync(path, JSON.stringify(ordinary()));
    const result = spawnSync(
      process.execPath,
      [join(linked, "review-release.mjs"), path],
      { encoding: "utf8", shell: false },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).decision, "PASS");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const field of ["deployment", "preview"]) {
  for (const age of [3_600_001, -1]) {
    test(`rejects stale or future ${field} observation at age ${age}`, () => {
      const evidence = ordinary();
      evidence[field].observedAt = NOW - age;
      assert.equal(evaluate(evidence).decision, "FAIL");
    });
  }
  test(`rejects missing ${field} observation time`, () => {
    const evidence = ordinary();
    delete evidence[field].observedAt;
    assert.equal(evaluate(evidence).decision, "FAIL");
  });
}

test("rejects stale mandatory check even on the exact revision", () => {
  const evidence = ordinary();
  evidence.checks[0].observedAt = NOW - 3_600_001;
  assert.equal(evaluate(evidence).decision, "FAIL");
});

test("rejects missing mandatory check timestamp", () => {
  const evidence = ordinary();
  delete evidence.checks[0].observedAt;
  assert.equal(evaluate(evidence).decision, "FAIL");
});

test("rejects invalid evidence freshness policy", () => {
  const evidence = ordinary();
  evidence.policy.maxEvidenceAgeMs = 0;
  assert.equal(evaluate(evidence).decision, "FAIL");
});

const TIME_FIELDS = new Set([
  "now",
  "observedAt",
  "lastObservedAt",
  "reviewedAt",
  "verifiedBefore",
  "verifiedAfter",
]);
function toSeconds(value) {
  if (Array.isArray(value)) value.forEach(toSeconds);
  else if (value !== null && typeof value === "object")
    for (const [key, item] of Object.entries(value)) {
      if (TIME_FIELDS.has(key)) value[key] = Math.floor(item / 1000);
      else toSeconds(item);
    }
}

test("epoch-seconds times fail closed instead of stretching freshness", () => {
  for (const evidence of [ordinary(), aliasEvidence()]) {
    toSeconds(evidence);
    assert.equal(evaluate(evidence).decision, "FAIL");
  }
});

test("age limits are capped at 24 hours", () => {
  for (const key of ["maxEvidenceAgeMs", "maxReviewAgeMs"]) {
    const evidence = ordinary();
    evidence.policy[key] = 86_400_000;
    assert.equal(evaluate(evidence).decision, "PASS");
    evidence.policy[key] = 86_400_001;
    assert.equal(evaluate(evidence).decision, "FAIL");
  }
});

test("sensitive approval requires concrete scope and owner instruction reference", () => {
  for (const absent of ["scope", "reference"]) {
    const evidence = ordinary();
    evidence.policy.sensitive = true;
    evidence.approval = {
      headSha: HEAD,
      baseSha: BASE,
      explicitOwnerApproval: true,
      scope: "Reviewed CI diff",
      reference: "Owner instruction 2026-10-22",
    };
    delete evidence.approval[absent];
    assert.equal(evaluate(evidence).decision, "FAIL");
  }
});

test("check observation in the future fails closed", () => {
  const evidence = ordinary();
  evidence.checks[0].observedAt = NOW + 1;
  assert.equal(evaluate(evidence).decision, "FAIL");
});

test("observation freshness accepts the exact configured boundary", () => {
  const evidence = ordinary();
  evidence.deployment.observedAt = NOW - evidence.policy.maxEvidenceAgeMs;
  evidence.preview.observedAt = NOW - evidence.policy.maxEvidenceAgeMs;
  evidence.checks.forEach((check) => {
    check.observedAt = NOW - evidence.policy.maxEvidenceAgeMs;
  });
  assert.equal(evaluate(evidence).decision, "PASS");
});

test("runbook synthetic JSON example conforms to the executable schema", () => {
  const source = readFileSync(
    new URL("../../docs/final-review-release.md", import.meta.url),
    "utf8",
  );
  const sample = source.match(/```json\r?\n([\s\S]*?)\r?\n```/);
  assert.ok(sample, "runbook supplies a JSON example");
  assert.deepEqual(evaluate(JSON.parse(sample[1])), {
    decision: "PASS",
    reasons: [],
  });
});

// Dropping any of these guards would allow incomplete or reclassified evidence
// to authorize the next release step. Expectations do not reuse evaluator logic.
const inventoryCases = [
  ["missing inventory", (e) => delete e.inventory, "FAIL"],
  ["incomplete inventory", (e) => (e.inventory.complete = false), "BLOCKED"],
  [
    "string inventory completeness",
    (e) => (e.inventory.complete = "true"),
    "FAIL",
  ],
  ["empty inventory", (e) => (e.inventory.names = []), "FAIL"],
  [
    "duplicate inventory name",
    (e) => e.inventory.names.push("quality"),
    "FAIL",
  ],
  ["malformed inventory name", (e) => e.inventory.names.push(null), "FAIL"],
  ["missing inventory entry", (e) => e.inventory.names.pop(), "FAIL"],
  [
    "unclassified inventory entry",
    (e) => e.inventory.names.push("security"),
    "BLOCKED",
  ],
  ["old inventory head", (e) => (e.inventory.headSha = OTHER), "FAIL"],
  ["old inventory base", (e) => (e.inventory.baseSha = OTHER), "FAIL"],
  [
    "expired inventory",
    (e) => (e.inventory.observedAt = NOW - 3_600_001),
    "FAIL",
  ],
  ["future inventory", (e) => (e.inventory.observedAt = NOW + 1), "FAIL"],
  ["missing inventory time", (e) => delete e.inventory.observedAt, "FAIL"],
  ["missing policy resolution", (e) => delete e.policy.resolution, "FAIL"],
  ["old policy head", (e) => (e.policy.resolution.headSha = OTHER), "FAIL"],
  ["old policy base", (e) => (e.policy.resolution.baseSha = OTHER), "FAIL"],
  [
    "expired policy",
    (e) => (e.policy.resolution.observedAt = NOW - 3_600_001),
    "FAIL",
  ],
  ["future policy", (e) => (e.policy.resolution.observedAt = NOW + 1), "FAIL"],
  [
    "missing resolver reference",
    (e) => delete e.policy.resolution.reference,
    "FAIL",
  ],
  [
    "empty resolver reference",
    (e) => (e.policy.resolution.reference = ""),
    "FAIL",
  ],
  [
    "missing optional check decisions",
    (e) => delete e.policy.optionalChecks,
    "FAIL",
  ],
  [
    "missing optional checklist decisions",
    (e) => delete e.policy.optionalChecklist,
    "FAIL",
  ],
  [
    "unclassified observed check",
    (e) => e.checks.push({ ...e.checks[0], name: "unclassified" }),
    "FAIL",
  ],
  [
    "unclassified preview result",
    (e) =>
      e.preview.results.push({
        id: "unclassified",
        status: "passed",
        authenticated: false,
      }),
    "FAIL",
  ],
];
for (const [name, mutate, want] of inventoryCases) {
  test(`inventory and scope: ${name}`, () => {
    const evidence = ordinary();
    mutate(evidence);
    assert.equal(evaluate(evidence).decision, want);
  });
}

for (const id of BASELINE) {
  test(`baseline ${id} cannot be omitted from policy and observations`, () => {
    const evidence = ordinary();
    evidence.policy.requiredChecklist =
      evidence.policy.requiredChecklist.filter((item) => item.id !== id);
    evidence.preview.results = evidence.preview.results.filter(
      (item) => item.id !== id,
    );
    assert.equal(evaluate(evidence).decision, "FAIL");
  });
  test(`baseline ${id} needs an actual observation`, () => {
    const evidence = ordinary();
    evidence.preview.results = evidence.preview.results.filter(
      (item) => item.id !== id,
    );
    assert.equal(evaluate(evidence).decision, "BLOCKED");
  });
}

function optionalEvidence(kind, applicable = false) {
  const evidence = ordinary();
  if (kind === "check") {
    evidence.inventory.names.push("optional-check");
    evidence.policy.optionalChecks.push({
      name: "optional-check",
      applicable,
      reason: "Synthetic scope decision",
    });
  } else {
    evidence.policy.optionalChecklist.push({
      id: "optional-flow",
      authenticated: true,
      applicable,
      reason: "Synthetic scope decision",
    });
  }
  return evidence;
}

function optionalResult(evidence, kind, status) {
  if (kind === "check") {
    evidence.checks.push({
      ...evidence.checks[0],
      name: "optional-check",
      status,
      attempts: [status],
    });
  } else {
    evidence.preview.results.push({
      id: "optional-flow",
      authenticated: true,
      status,
    });
  }
}

for (const kind of ["check", "checklist"]) {
  const decisions = (e) =>
    kind === "check" ? e.policy.optionalChecks : e.policy.optionalChecklist;
  test(`explicit nonapplicable optional ${kind} may be absent`, () => {
    const evidence = optionalEvidence(kind);
    // Only a name not reported in the inventory may lack an observation.
    if (kind === "check") evidence.inventory.names.pop();
    assert.equal(evaluate(evidence).decision, "PASS");
  });
  test(`explicit nonapplicable optional ${kind} may be skipped`, () => {
    const evidence = optionalEvidence(kind);
    optionalResult(evidence, kind, "skipped");
    assert.equal(evaluate(evidence).decision, "PASS");
  });
  test(`applicable optional ${kind} must be observed`, () => {
    assert.equal(evaluate(optionalEvidence(kind, true)).decision, "BLOCKED");
  });
  test(`applicable optional ${kind} passes with evidence`, () => {
    const evidence = optionalEvidence(kind, true);
    optionalResult(evidence, kind, "passed");
    assert.equal(evaluate(evidence).decision, "PASS");
  });
  for (const applicable of [true, false]) {
    for (const [status, want] of [
      ["failed", "FAIL"],
      ["pending", "BLOCKED"],
      ["blocked", "BLOCKED"],
      ["skipped", applicable ? "FAIL" : "PASS"],
    ]) {
      test(`optional ${kind} applicable=${applicable} ${status} -> ${want}`, () => {
        const evidence = optionalEvidence(kind, applicable);
        optionalResult(evidence, kind, status);
        assert.equal(evaluate(evidence).decision, want);
      });
    }
  }
  for (const [name, mutate] of [
    ["missing applicability", (d) => delete d.applicable],
    ["string applicability", (d) => (d.applicable = "false")],
    ["missing reason", (d) => delete d.reason],
    ["empty reason", (d) => (d.reason = "")],
  ]) {
    test(`optional ${kind} ${name} fails closed`, () => {
      const evidence = optionalEvidence(kind);
      mutate(decisions(evidence)[0]);
      assert.equal(evaluate(evidence).decision, "FAIL");
    });
  }
  test(`duplicate optional ${kind} fails closed`, () => {
    const evidence = optionalEvidence(kind);
    decisions(evidence).push({ ...decisions(evidence)[0] });
    assert.equal(evaluate(evidence).decision, "FAIL");
  });
  test(`required ${kind} cannot also be optional`, () => {
    const evidence = optionalEvidence(kind);
    if (kind === "check") decisions(evidence)[0].name = "quality";
    else decisions(evidence)[0].id = "desktop";
    assert.equal(evaluate(evidence).decision, "FAIL");
  });
}

test("nonapplicable optional check in the inventory needs an observed result", () => {
  assert.equal(evaluate(optionalEvidence("check")).decision, "BLOCKED");
});

test("optional applicable authenticated preview cannot pass anonymously", () => {
  const evidence = optionalEvidence("checklist", true);
  optionalResult(evidence, "checklist", "passed");
  evidence.preview.results.at(-1).authenticated = false;
  assert.equal(evaluate(evidence).decision, "BLOCKED");
});

test("optional waiver cannot erase failed attempts or flaky state", () => {
  for (const attempts of [
    ["failed", "skipped"],
    ["skipped", "passed"],
  ]) {
    const evidence = optionalEvidence("check");
    optionalResult(evidence, "check", attempts.at(-1));
    evidence.checks.at(-1).attempts = attempts;
    assert.equal(evaluate(evidence).decision, "FAIL");
  }
  const evidence = optionalEvidence("check");
  optionalResult(evidence, "check", "skipped");
  evidence.checks.at(-1).flaky = true;
  assert.equal(evaluate(evidence).decision, "FAIL");
});

test("nonapplicable optional evidence still needs current revision and time", () => {
  const evidence = optionalEvidence("check");
  optionalResult(evidence, "check", "skipped");
  evidence.checks.at(-1).headSha = OTHER;
  evidence.checks.at(-1).observedAt = NOW - 3_600_001;
  assert.equal(evaluate(evidence).decision, "FAIL");
});

// A mutable branch alias is acceptable only when verified around the checks.
function aliasEvidence() {
  const evidence = ordinary();
  evidence.deployment.immutable = false;
  evidence.deployment.aliasVerification = {
    url: PREVIEW_URL,
    deploymentId: "dpl_synthetic123",
    sha: HEAD,
    verifiedBefore: NOW - 120_000,
    verifiedAfter: NOW - 30_000,
  };
  return evidence;
}

test("verified branch alias permits PASS", () => {
  assert.deepEqual(evaluate(aliasEvidence()), {
    decision: "PASS",
    reasons: [],
  });
});

test("verification may coincide with the preview observation", () => {
  const evidence = aliasEvidence();
  evidence.deployment.aliasVerification.verifiedBefore = NOW - 60_000;
  evidence.deployment.aliasVerification.verifiedAfter = NOW - 60_000;
  assert.equal(evaluate(evidence).decision, "PASS");
});

const aliasCases = [
  [
    "missing alias verification",
    (a, e) => (e.deployment.aliasVerification = null),
    "BLOCKED",
  ],
  ["alias for another SHA", (a) => (a.sha = OTHER), "FAIL"],
  [
    "alias for another URL",
    (a) => (a.url = "https://other.vercel.app/"),
    "FAIL",
  ],
  [
    "preview before alias verification",
    (a) => (a.verifiedBefore = NOW - 59_999),
    "FAIL",
  ],
  [
    "preview after alias verification",
    (a) => (a.verifiedAfter = NOW - 60_001),
    "FAIL",
  ],
  [
    "reversed verification window",
    (a) => (
      (a.verifiedBefore = NOW - 30_000),
      (a.verifiedAfter = NOW - 120_000)
    ),
    "FAIL",
  ],
  [
    "stale alias verification",
    (a) => (a.verifiedBefore = NOW - 3_600_001),
    "FAIL",
  ],
  ["future alias verification", (a) => (a.verifiedAfter = NOW + 1), "FAIL"],
  [
    "last preview observation after alias verification",
    (a, e) => (e.preview.lastObservedAt = NOW - 29_999),
    "FAIL",
  ],
  [
    "alias for another deployment",
    (a) => (a.deploymentId = "dpl_other"),
    "FAIL",
  ],
  ["missing deployment ID", (a) => delete a.deploymentId, "FAIL"],
  ["empty deployment ID", (a) => (a.deploymentId = ""), "FAIL"],
  [
    "credential-bearing alias URL",
    (a) => (a.url = `${PREVIEW_URL}?token=secret`),
    "FAIL",
  ],
  ["short alias SHA", (a) => (a.sha = "abc123"), "FAIL"],
  [
    "string verification time",
    (a) => (a.verifiedBefore = String(NOW - 120_000)),
    "FAIL",
  ],
  ["negative verification time", (a) => (a.verifiedAfter = -1), "FAIL"],
  ["missing verification time", (a) => delete a.verifiedAfter, "FAIL"],
  [
    "nonobject alias verification",
    (a, e) => (e.deployment.aliasVerification = "verified"),
    "FAIL",
  ],
  [
    "array alias verification",
    (a, e) => (e.deployment.aliasVerification = []),
    "FAIL",
  ],
];
for (const [name, mutate, want] of aliasCases) {
  test(`branch alias: ${name} -> ${want}`, () => {
    const evidence = aliasEvidence();
    mutate(evidence.deployment.aliasVerification, evidence);
    const result = evaluate(evidence);
    assert.equal(result.decision, want);
    assert.doesNotMatch(JSON.stringify(result), /token=secret|dpl_synthetic/);
  });
}

for (const [name, mutate] of [
  ["missing deployment id", (e) => delete e.deployment.id],
  ["empty deployment id", (e) => (e.deployment.id = "")],
  ["missing last preview observation", (e) => delete e.preview.lastObservedAt],
  [
    "last preview observation before the first",
    (e) => (e.preview.lastObservedAt = NOW - 60_001),
  ],
  [
    "future last preview observation",
    (e) => (e.preview.lastObservedAt = NOW + 1),
  ],
]) {
  test(`deployment and preview window: ${name} -> FAIL`, () => {
    const evidence = ordinary();
    mutate(evidence);
    assert.equal(evaluate(evidence).decision, "FAIL");
  });
}

test("immutable deployment accepts a valid alias record but rejects a malformed one", () => {
  const evidence = aliasEvidence();
  evidence.deployment.immutable = true;
  assert.equal(evaluate(evidence).decision, "PASS");
  evidence.deployment.aliasVerification.deploymentId = "";
  assert.equal(evaluate(evidence).decision, "FAIL");
});
