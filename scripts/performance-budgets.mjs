import { STRICT_LIMITS } from './performance-policy.mjs';

const fields = {
  performance: report => report.categories?.performance?.score,
  accessibility: report => report.categories?.accessibility?.score,
  lcp: report => report.audits?.["largest-contentful-paint"]?.numericValue,
  tbt: report => report.audits?.["total-blocking-time"]?.numericValue,
  cls: report => report.audits?.["cumulative-layout-shift"]?.numericValue,
};

export function evaluatePerformance(reports, policy = {id:'strict',limits:STRICT_LIMITS}) {
  if (reports.length !== 3) throw new Error("Release measurements require exactly three runs per route");
  const median = {};
  for (const [key, read] of Object.entries(fields)) {
    const values = reports.map(read);
    if (values.some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
      throw new Error(`Lighthouse ${key} is missing or invalid`);
    }
    median[key] = values.sort((a, b) => a - b)[1];
  }
  const failuresFor = limits => {
    const failures = [];
    if (median.performance < limits.performance) failures.push(`Performance ${median.performance * 100} < ${limits.performance * 100}`);
    if (median.accessibility < limits.accessibility) failures.push(`Accessibility ${median.accessibility * 100} < ${limits.accessibility * 100}`);
    for (const key of ['lcp','tbt','cls']) if (median[key] > limits[key]) failures.push(`${key} ${median[key]} > ${limits[key]}`);
    return failures;
  };
  return { median, failures:failuresFor(policy.limits), targetFailures:failuresFor(STRICT_LIMITS), policy };
}
