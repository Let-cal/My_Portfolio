const fields = {
  performance: report => report.categories?.performance?.score,
  accessibility: report => report.categories?.accessibility?.score,
  lcp: report => report.audits?.["largest-contentful-paint"]?.numericValue,
  tbt: report => report.audits?.["total-blocking-time"]?.numericValue,
  cls: report => report.audits?.["cumulative-layout-shift"]?.numericValue,
};

export function evaluatePerformance(reports) {
  if (reports.length !== 3) throw new Error("Release measurements require exactly three runs per route");
  const median = {};
  for (const [key, read] of Object.entries(fields)) {
    const values = reports.map(read);
    if (values.some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
      throw new Error(`Lighthouse ${key} is missing or invalid`);
    }
    median[key] = values.sort((a, b) => a - b)[1];
  }
  const failures = [];
  if (median.performance < 0.85) failures.push(`Performance ${median.performance * 100} < 85`);
  if (median.accessibility < 0.95) failures.push(`Accessibility ${median.accessibility * 100} < 95`);
  for (const [key, limit] of [["lcp", 2500], ["tbt", 200], ["cls", 0.1]]) {
    if (median[key] > limit) failures.push(`${key} ${median[key]} > ${limit}`);
  }
  return { median, failures };
}
