// Lighthouse lab results vary between runs on shared CI machines, so only the
// stable signals block a merge. Loading metrics are reported as advisory targets;
// real-user Core Web Vitals come from Vercel Speed Insights in production.
export const BLOCKING = { accessibility: 0.95, seo: 0.9, cls: 0.1 };
export const ADVISORY = { performance: 0.85, lcp: 2500, tbt: 200 };

const fields = {
  performance: (report) => report.categories?.performance?.score,
  accessibility: (report) => report.categories?.accessibility?.score,
  seo: (report) => report.categories?.seo?.score,
  lcp: (report) => report.audits?.["largest-contentful-paint"]?.numericValue,
  tbt: (report) => report.audits?.["total-blocking-time"]?.numericValue,
  cls: (report) => report.audits?.["cumulative-layout-shift"]?.numericValue,
};

const isScore = (key) => ["performance", "accessibility", "seo"].includes(key);
const missed = (key, value, limit) =>
  isScore(key) ? value < limit : value > limit;
const describe = (key, value, limit) =>
  isScore(key)
    ? `${key} ${Math.round(value * 100)} < ${limit * 100}`
    : `${key} ${Math.round(value * 1000) / 1000} > ${limit}`;

export function evaluatePerformance(reports) {
  if (reports.length !== 3)
    throw new Error(
      "Lighthouse measurements require exactly three runs per route",
    );
  const median = {};
  for (const [key, read] of Object.entries(fields)) {
    const values = reports.map(read);
    if (
      values.some(
        (value) =>
          typeof value !== "number" || !Number.isFinite(value) || value < 0,
      )
    ) {
      throw new Error(`Lighthouse ${key} is missing or invalid`);
    }
    median[key] = values.sort((a, b) => a - b)[1];
  }
  const check = (limits) =>
    Object.entries(limits)
      .filter(([key, limit]) => missed(key, median[key], limit))
      .map(([key, limit]) => describe(key, median[key], limit));
  return { median, failures: check(BLOCKING), warnings: check(ADVISORY) };
}
