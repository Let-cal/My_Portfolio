import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePerformance } from "../../scripts/performance-budgets.mjs";

const report = (values = {}) => ({
  categories: {
    performance: { score: values.performance ?? 0.9 },
    accessibility: { score: values.accessibility ?? 1 },
    seo: { score: values.seo ?? 1 },
  },
  audits: {
    "largest-contentful-paint": { numericValue: values.lcp ?? 2000 },
    "total-blocking-time": { numericValue: values.tbt ?? 100 },
    "cumulative-layout-shift": { numericValue: values.cls ?? 0.01 },
  },
});

test("requires three complete measurements and rejects missing or invalid data", () => {
  assert.throws(() => evaluatePerformance([report()]), /three/);
  assert.throws(() => evaluatePerformance([{}, report(), report()]), /missing|invalid/);
  assert.throws(() => evaluatePerformance([report({ lcp: NaN }), report(), report()]), /missing|invalid/);
});

test("uses the median, so one outlier run does not change the result", () => {
  const result = evaluatePerformance([report(), report(), report({ lcp: 10000, accessibility: 0.5 })]);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.warnings, []);
});

test("accessibility, SEO and layout shift block; loading metrics only warn", () => {
  const slow = report({ performance: 0.8, lcp: 3600, tbt: 340 });
  const result = evaluatePerformance([slow, slow, report()]);
  assert.deepEqual(result.failures, []);
  assert.equal(result.warnings.length, 3);

  const broken = report({ accessibility: 0.94, seo: 0.89, cls: 0.11 });
  assert.equal(evaluatePerformance([broken, broken, report()]).failures.length, 3);
});
