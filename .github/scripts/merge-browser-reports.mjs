import {
  copyFileSync,
  constants,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { summarizePlaywright } from "./playwright-summary.mjs";

function reject() {
  throw new Error("Incomplete or inconsistent browser shard evidence");
}

function testIds(report) {
  if (
    !report ||
    !Array.isArray(report.suites) ||
    !Array.isArray(report.errors) ||
    report.errors.length
  )
    reject();
  const ids = new Set();
  function visit(suite) {
    if (!suite || !Array.isArray(suite.specs)) reject();
    for (const spec of suite.specs) {
      if (
        typeof spec.id !== "string" ||
        !spec.id ||
        !Array.isArray(spec.tests) ||
        !spec.tests.length
      )
        reject();
      for (const test of spec.tests) {
        if (typeof test.projectId !== "string" || !test.projectId) reject();
        const id = JSON.stringify([spec.id, test.projectId]);
        if (ids.has(id)) reject();
        ids.add(id);
      }
    }
    if (suite.suites !== undefined) {
      if (!Array.isArray(suite.suites)) reject();
      for (const child of suite.suites) visit(child);
    }
  }
  for (const suite of report.suites) visit(suite);
  if (!ids.size) reject();
  return ids;
}

export function verifyShardReports(reports, inventory, identity) {
  if (
    !identity ||
    !/^[a-f0-9]{40}$/i.test(identity.revision) ||
    !/^\d+$/.test(identity.runId) ||
    !/^[1-9]\d*$/.test(identity.runAttempt) ||
    !Array.isArray(reports) ||
    reports.length !== 2
  )
    reject();
  const expected = testIds(inventory);
  const seen = new Set();
  const indices = new Set();
  return reports.map((report, position) => {
    const shard = report?.config?.shard;
    const metadata = report?.config?.metadata;
    if (
      !shard ||
      shard.total !== 2 ||
      ![1, 2].includes(shard.current) ||
      indices.has(shard.current) ||
      !metadata ||
      metadata.ciRevision !== identity.revision ||
      metadata.ciRun !== identity.runId ||
      metadata.ciAttempt !== identity.runAttempt
    )
      reject();
    indices.add(shard.current);
    const summary = summarizePlaywright(report);
    if (
      summary.errors.length ||
      summary.counts.unexpected ||
      summary.counts.flaky ||
      summary.counts.skipped
    )
      reject();
    for (const id of testIds(report)) {
      if (!expected.has(id) || seen.has(id)) reject();
      seen.add(id);
    }
    if (position === reports.length - 1 && seen.size !== expected.size)
      reject();
    return summary;
  });
}

function main(args) {
  if (args.length !== 2) {
    console.error(
      "Usage: node merge-browser-reports.mjs <artifact-directory> <inventory.json>",
    );
    return 1;
  }
  try {
    const identity = {
      revision: process.env.GITHUB_SHA,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    };
    // Validate before using environment values in artifact paths.
    if (
      !/^[a-f0-9]{40}$/i.test(identity.revision ?? "") ||
      !/^\d+$/.test(identity.runId ?? "") ||
      !/^[1-9]\d*$/.test(identity.runAttempt ?? "")
    )
      reject();
    const root = resolve(args[0]);
    const directories = [1, 2].map((index) =>
      join(
        root,
        `playwright-shard-${identity.runId}-${identity.runAttempt}-${index}`,
      ),
    );
    const reports = directories.map((directory, index) =>
      JSON.parse(
        readFileSync(
          join(directory, "reports", `browser-${index + 1}.json`),
          "utf8",
        ),
      ),
    );
    const summaries = verifyShardReports(
      reports,
      JSON.parse(readFileSync(args[1], "utf8")),
      identity,
    );
    const blobs = directories.map((directory) => {
      const folder = join(directory, "blob-report");
      const files = readdirSync(folder).filter((name) => name.endsWith(".zip"));
      if (files.length !== 1) reject();
      const blob = join(folder, files[0]);
      if (!lstatSync(blob).isFile()) reject();
      return blob;
    });
    const destination = join(root, "verified-blobs");
    // A fresh folder prevents a previous invocation's blob from silently joining this run.
    mkdirSync(destination);
    for (const [index, blob] of blobs.entries())
      copyFileSync(
        blob,
        join(destination, `shard-${index + 1}.zip`),
        constants.COPYFILE_EXCL,
      );
    for (const [index, summary] of summaries.entries()) {
      console.log(
        `Shard ${index + 1}: ${summary.counts.expected} passed; elapsed ${summary.durationMs} ms`,
      );
      for (const file of summary.files)
        console.log(
          `  File: ${file.file} | summed attempts ${file.durationMs} ms | ${file.tests} tests`,
        );
    }
    console.log(
      "Both shards match the current revision/run and cover the full discovered suite without skipped or flaky cases.",
    );
    return 0;
  } catch {
    // Never include report errors, attachments, environment values or file contents.
    console.error(
      "Browser aggregate rejected missing, failed, stale, flaky or inconsistent shard evidence.",
    );
    return 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  process.exitCode = main(process.argv.slice(2));
