import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { evaluatePerformance } from "./performance-budgets.mjs";
import { readApplicationHash, resolvePerformancePolicy } from './performance-policy.mjs';

const exception = JSON.parse(readFileSync(new URL('./fe-v1-performance-exception.json',import.meta.url),'utf8'));
const policy = resolvePerformancePolicy({exception,applicationHash:readApplicationHash()});
console.log(`Release policy: ${JSON.stringify(policy)}`);

const origin = process.env.PERF_ORIGIN ?? "http://localhost:3100";
const routes = process.argv.slice(2);
const output = process.env.PERF_OUTPUT ?? ".lighthouseci";
mkdirSync(output, { recursive: true });
function deliveryHealth() {
  if(!process.env.PERF_DELIVERY_ERROR_FILE)return;
  try { readFileSync(process.env.PERF_DELIVERY_ERROR_FILE); }
  catch(error) { if(error.code==='ENOENT')return; throw error; }
  throw new Error('Production transport proxy reported an upstream failure');
}
const summary = [];
for (const locale of routes.length ? routes : ["en", "ja", "vi"]) {
  if (!["en", "ja", "vi"].includes(locale)) throw new Error(`Unknown release locale: ${locale}`);
  const reports = [];
  for (let run = 1; run <= 3; run++) {
    deliveryHealth();
    const file = join(output, `${locale}-${run}.json`);
    const result = spawnSync(process.execPath, [
      "node_modules/lighthouse/cli/index.js", `${origin}/${locale}`,
      "--form-factor=mobile", "--only-categories=performance,accessibility,best-practices,seo",
      "--output=json", `--output-path=${file}`,
      ...(process.env.PERF_TRACE === "1" && run === 1 ? ["--save-assets"] : []),
      `--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage${process.env.PERF_REQUIRE_HTTP2==='1'?' --allow-insecure-localhost':''}`, "--quiet",
    ], { encoding: "utf8", timeout: 120_000 });
    if (result.status !== 0) throw new Error(`Lighthouse failed for ${locale} run ${run}: ${result.error?.message ?? result.stderr}`);
    const report = JSON.parse(readFileSync(file, "utf8"));
    if (report.runtimeError) throw new Error(`Lighthouse runtime error: ${report.runtimeError.message}`);
    if(process.env.PERF_REQUIRE_HTTP2==='1') {
      const requests=report.audits['network-requests']?.details?.items?.filter(item=>URL.canParse(item.url)&&new URL(item.url).origin===new URL(origin).origin);
      if(!requests?.length||requests.some(item=>item.protocol!=='h2'))throw new Error('Production transport must negotiate HTTP/2 for all same-origin resources');
    }
    deliveryHealth();
    reports.push(report);
    console.log(`${locale}: collected run ${run}/3`);
  }
  const result = { route: `/${locale}`, origin, transport:process.env.PERF_REQUIRE_HTTP2==='1'?'http2-brotli':'direct-http1-diagnostic', ...evaluatePerformance(reports, policy) };
  console.log(JSON.stringify(result));
  summary.push(result);
}
writeFileSync(join(output, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
deliveryHealth();
if (summary.some(result => result.failures.length)) process.exitCode = 1;
