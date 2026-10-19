import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  ADVISORY,
  BLOCKING,
  evaluatePerformance,
} from "./performance-budgets.mjs";

const origin = process.env.PERF_ORIGIN ?? "http://localhost:3100";
const routes = process.argv.slice(2);
const output = process.env.PERF_OUTPUT ?? ".lighthouseci";
mkdirSync(output, { recursive: true });

const summary = [];
for (const locale of routes.length ? routes : ["en", "ja", "vi"]) {
  if (!["en", "ja", "vi"].includes(locale))
    throw new Error(`Unknown locale: ${locale}`);
  const reports = [];
  for (let run = 1; run <= 3; run++) {
    const file = join(output, `${locale}-${run}.json`);
    const result = spawnSync(
      process.execPath,
      [
        "node_modules/lighthouse/cli/index.js",
        `${origin}/${locale}`,
        "--form-factor=mobile",
        "--only-categories=performance,accessibility,best-practices,seo",
        "--output=json",
        `--output-path=${file}`,
        ...(process.env.PERF_TRACE === "1" && run === 1
          ? ["--save-assets"]
          : []),
        "--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage",
        "--quiet",
      ],
      { encoding: "utf8", timeout: 120_000 },
    );
    if (result.status !== 0)
      throw new Error(
        `Lighthouse failed for ${locale} run ${run}: ${result.error?.message ?? result.stderr}`,
      );
    const report = JSON.parse(readFileSync(file, "utf8"));
    if (report.runtimeError)
      throw new Error(
        `Lighthouse runtime error: ${report.runtimeError.message}`,
      );
    reports.push(report);
    console.log(`${locale}: collected run ${run}/3`);
  }
  const result = {
    route: `/${locale}`,
    origin,
    ...evaluatePerformance(reports),
  };
  console.log(JSON.stringify(result));
  summary.push(result);
}
writeFileSync(
  join(output, "summary.json"),
  JSON.stringify(summary, null, 2) + "\n",
);

if (process.env.GITHUB_STEP_SUMMARY) {
  const pct = (value) => Math.round(value * 100);
  const verdict = ({ failures, warnings }) =>
    failures.length
      ? `❌ ${failures.join(", ")}`
      : warnings.length
        ? `⚠️ ${warnings.join(", ")}`
        : "✅";
  const rows = summary.map(
    (r) =>
      `| ${r.route} | ${pct(r.median.performance)} | ${pct(r.median.accessibility)} | ${pct(r.median.seo)} | ` +
      `${Math.round(r.median.lcp)} | ${Math.round(r.median.tbt)} | ${r.median.cls.toFixed(3)} | ${verdict(r)} |`,
  );
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      "### Lighthouse mobile (median of 3 runs)",
      "",
      "| Route | Performance | Accessibility | SEO | LCP ms | TBT ms | CLS | Result |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
      ...rows,
      "",
      `Blocking: accessibility ≥ ${BLOCKING.accessibility * 100}, SEO ≥ ${BLOCKING.seo * 100}, CLS ≤ ${BLOCKING.cls}. ` +
        `Advisory lab targets (simulated mid-range phone): performance ≥ ${ADVISORY.performance * 100}, ` +
        `LCP ≤ ${ADVISORY.lcp} ms, TBT ≤ ${ADVISORY.tbt} ms. Field data: Vercel Speed Insights.`,
      "",
    ].join("\n"),
  );
}

for (const { route, warnings } of summary) {
  for (const warning of warnings)
    console.log(`::warning title=Lighthouse ${route}::${warning} (advisory)`);
}
if (summary.some((result) => result.failures.length)) process.exitCode = 1;
