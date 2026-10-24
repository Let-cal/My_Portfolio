import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const caveats = [
  "Requires fullyParallel discovery. Only tests/e2e/veil.spec.ts may split: veil cases must remain independent, explicitly parallel, without serial suites or beforeAll/afterAll hooks. JSON discovery does not expose suite execution mode; the source contract test enforces this assumption. All other files remain atomic.",
  "Estimates are summed test durations, excluding setup, build, queue and runner overhead; they do not establish an observed CI speedup.",
];

function reject() {
  throw new Error("Invalid or ambiguous browser planning input");
}
function text(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.trim() !== value ||
    /[\p{Cc}\p{Cf}\u2028\u2029>›]/u.test(value)
  )
    reject();
  return value;
}
function file(value) {
  text(value);
  if (
    /[\\<>:"|?*]/u.test(value) ||
    value
      .split("/")
      .some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          part.trim() !== part ||
          /[. ]$/.test(part),
      )
  )
    reject();
  return value;
}
function absolute(value) {
  const normalized = text(value).replaceAll("\\", "/");
  if (!/^(?:[A-Za-z]:)?\//.test(normalized) || normalized.startsWith("//"))
    reject();
  // Metadata is machine-specific; only its repository-relative suffix enters the plan.
  file(normalized.replace(/^(?:[A-Za-z]:)?\//, ""));
  return normalized;
}
function titles(value) {
  if (!Array.isArray(value) || !value.length) reject();
  return value.map(text);
}
function duration(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    reject();
  return value;
}
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const timingKey = (file, titlePath, projectId) =>
  JSON.stringify([file, titlePath, projectId]);

/**
 * Timings v1: { version: 1, samples: [{ file, titlePath, projectId, durationMs }],
 * provenance: { revision: <source-head SHA>, runs: [{ id, revision: <checkout SHA> }] } }.
 * Files are normalized repository-relative POSIX paths (tests/e2e/...). titlePath
 * contains every describe title followed by the test title, excluding file/project.
 * Baseline durationMs is the median successful first-attempt duration in three runs;
 * provenance records the distinct merge-checkout SHA where applicable, without raw reports.
 *
 * Returns exactly two { index, estimatedMs, tests: [{ id, selector, estimatedMs }] }.
 * Safety assumption: the explicit veil allowlist must stay independently parallel;
 * JSON cannot detect future serial describes/hooks. Keep its source contract test.
 * Every other file (including its projects) is an indivisible scheduling unit.
 */
export function planBrowserGroups(inventory, timings) {
  if (
    timings?.version !== 1 ||
    !Array.isArray(timings.samples) ||
    !timings.samples.length ||
    !/^[a-f0-9]{40}$/i.test(timings.provenance?.revision ?? "") ||
    !Array.isArray(timings.provenance?.runs) ||
    !timings.provenance.runs.length
  )
    reject();
  const runs = new Set();
  for (const run of timings.provenance.runs) {
    if (
      typeof run?.id !== "string" ||
      !/^[1-9]\d*$/.test(run.id) ||
      runs.has(run.id) ||
      !/^[a-f0-9]{40}$/i.test(run.revision ?? "")
    )
      reject();
    runs.add(run.id);
  }
  const measured = new Map();
  for (const sample of timings.samples) {
    const key = timingKey(
      file(sample?.file),
      titles(sample.titlePath),
      text(sample.projectId),
    );
    if (measured.has(key)) reject();
    measured.set(key, duration(sample.durationMs));
  }
  const values = [...measured.values()].sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const fallback = duration(
    Math.ceil(
      values.length % 2
        ? values[middle]
        : values[middle - 1] / 2 + values[middle] / 2,
    ),
  );

  if (
    inventory?.config?.fullyParallel !== true ||
    inventory.config.shard != null ||
    !Array.isArray(inventory.suites) ||
    !Array.isArray(inventory.errors) ||
    inventory.errors.length ||
    !Array.isArray(inventory.config.projects) ||
    !inventory.config.projects.length
  )
    reject();
  const repo = posix.dirname(absolute(inventory.config.configFile));
  const testRoot = absolute(inventory.config.rootDir);
  if (testRoot !== repo && !testRoot.startsWith(repo + "/")) reject();
  const prefix =
    testRoot === repo ? "" : file(testRoot.slice(repo.length + 1)) + "/";
  const projects = new Map();
  const names = new Set();
  for (const project of inventory.config.projects) {
    const id = text(project?.id);
    const name = text(project.name);
    if (projects.has(id) || names.has(name) || /[\[\]]/.test(name)) reject();
    projects.set(id, name);
    names.add(name);
  }
  const seen = new Set();
  const selectors = new Map();
  const units = new Map();
  function visit(suite, relativeFile, parents) {
    if (
      !suite ||
      suite.file !== relativeFile ||
      !Array.isArray(suite.specs) ||
      (suite.suites !== undefined && !Array.isArray(suite.suites))
    )
      reject();
    for (const spec of suite.specs) {
      text(spec?.id);
      if (
        spec.file !== relativeFile ||
        !Array.isArray(spec.tests) ||
        !spec.tests.length
      )
        reject();
      const titlePath = [...parents, text(spec.title)];
      const repoFile = file(prefix + relativeFile);
      for (const project of spec.tests) {
        const projectId = text(project?.projectId);
        const name = projects.get(projectId);
        if (
          !name ||
          (project.projectName !== undefined && project.projectName !== name)
        )
          reject();
        const id = JSON.stringify([spec.id, projectId]);
        if (seen.has(id)) reject();
        seen.add(id);
        const selector = [`[${name}]`, relativeFile, ...titlePath].join(" › ");
        const selectorKey = JSON.stringify([name, relativeFile]);
        const previous = selectors.get(selectorKey) ?? [];
        // Playwright's official --test-list filter matches title prefixes as well as exact titles.
        for (const other of previous) {
          if (
            titlePath
              .slice(0, Math.min(other.length, titlePath.length))
              .every((part, index) => part === other[index])
          )
            reject();
        }
        previous.push(titlePath);
        selectors.set(selectorKey, previous);
        const estimatedMs =
          measured.get(timingKey(repoFile, titlePath, projectId)) ?? fallback;
        const entry = { id, selector, estimatedMs };
        const unitKey =
          repoFile === "tests/e2e/veil.spec.ts"
            ? JSON.stringify([repoFile, selector])
            : JSON.stringify([repoFile]);
        const unit = units.get(unitKey) ?? {
          key: unitKey,
          estimatedMs: 0,
          tests: [],
        };
        unit.estimatedMs = duration(unit.estimatedMs + estimatedMs);
        unit.tests.push(entry);
        units.set(unitKey, unit);
      }
    }
    for (const child of suite.suites ?? [])
      visit(child, relativeFile, [...parents, text(child?.title)]);
  }
  for (const suite of inventory.suites) {
    const relativeFile = file(suite?.file);
    if (suite.title !== relativeFile) reject();
    visit(suite, relativeFile, []);
  }
  if (units.size < 2) reject();
  const groups = [1, 2].map((index) => ({ index, estimatedMs: 0, tests: [] }));
  const ordered = [...units.values()].sort(
    (a, b) => b.estimatedMs - a.estimatedMs || compare(a.key, b.key),
  );
  for (const unit of ordered) {
    const group =
      groups[0].estimatedMs <= groups[1].estimatedMs ? groups[0] : groups[1];
    group.estimatedMs = duration(group.estimatedMs + unit.estimatedMs);
    group.tests.push(
      ...unit.tests.sort(
        (a, b) => compare(a.selector, b.selector) || compare(a.id, b.id),
      ),
    );
  }
  if (groups.some((group) => !group.tests.length)) reject();
  return groups;
}

function main(args) {
  if (args.length !== 3) {
    console.error(
      "Usage: node plan-browser-groups.mjs <inventory.json> <timings.json> <output-directory>",
    );
    return 1;
  }
  try {
    const groups = planBrowserGroups(
      JSON.parse(readFileSync(args[0], "utf8")),
      JSON.parse(readFileSync(args[1], "utf8")),
    );
    const directory = resolve(args[2]);
    // Parent must exist. Refuse an existing directory, including stale reports or symlinks.
    mkdirSync(directory);
    for (const group of groups)
      writeFileSync(
        posix.join(directory.replaceAll("\\", "/"), `group-${group.index}.txt`),
        group.tests.map((entry) => entry.selector).join("\n") + "\n",
        { flag: "wx" },
      );
    writeFileSync(
      posix.join(directory.replaceAll("\\", "/"), "plan.json"),
      JSON.stringify({ version: 1, groups, caveats }, null, 2) + "\n",
      { flag: "wx" },
    );
    for (const group of groups)
      console.log(
        `Group ${group.index}: ${group.tests.length} tests; estimated ${group.estimatedMs} ms`,
      );
    return 0;
  } catch {
    console.error(
      "Browser planning rejected invalid, ambiguous or unsafe input/output.",
    );
    return 1;
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  process.exitCode = main(process.argv.slice(2));
