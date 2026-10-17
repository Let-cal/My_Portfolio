import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { evaluatePerformance } from "./performance-budgets.mjs";

const origin = process.env.PERF_ORIGIN ?? "http://localhost:3100";
const routes = process.argv.slice(2);
const output = ".lighthouseci";
mkdirSync(output, { recursive: true });
const summary = [];
for (const locale of routes.length ? routes : ["en", "ja", "vi"]) {
  if (!["en", "ja", "vi"].includes(locale)) throw new Error(`Unknown release locale: ${locale}`);
  const reports = [];
  for (let run = 1; run <= 3; run++) {
    const file = join(output, `${locale}-${run}.json`);
    const result = spawnSync(process.execPath, [
      "node_modules/lighthouse/cli/index.js", `${origin}/${locale}`,
      "--form-factor=mobile", "--only-categories=performance,accessibility,best-practices,seo",
      "--output=json", `--output-path=${file}`,
      ...(process.env.PERF_TRACE === "1" && run === 1 ? ["--save-assets"] : []),
      "--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage", "--quiet",
    ], { encoding: "utf8", timeout: 120_000 });
    if (result.status !== 0) throw new Error(`Lighthouse failed for ${locale} run ${run}: ${result.error?.message ?? result.stderr}`);
    const report = JSON.parse(readFileSync(file, "utf8"));
    if (report.runtimeError) throw new Error(`Lighthouse runtime error: ${report.runtimeError.message}`);
    reports.push(report);
    console.log(`${locale}: collected run ${run}/3`);
  }
  const result = { route: `/${locale}`, ...evaluatePerformance(reports) };
  console.log(JSON.stringify(result));
  summary.push(result);
}
writeFileSync(join(output, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
if (summary.some(result => result.failures.length)) process.exitCode = 1;
