import test from "node:test";
import assert from "node:assert/strict";

const report = (values = {}) => ({
  categories: { performance: { score: values.performance ?? 0.9 }, accessibility: { score: values.accessibility ?? 1 } },
  audits: {
    "largest-contentful-paint": { numericValue: values.lcp ?? 2000 },
    "total-blocking-time": { numericValue: values.tbt ?? 100 },
    "cumulative-layout-shift": { numericValue: values.cls ?? 0.01 },
  },
});
const budgets = await import("../../scripts/performance-budgets.mjs").catch(() => null);

test("release gate requires three complete measurements and rejects missing or invalid data", () => {
  assert.ok(budgets, "performance release gate has not been implemented");
  assert.throws(() => budgets.evaluatePerformance([report()]), /three/);
  assert.throws(() => budgets.evaluatePerformance([{}, report(), report()]), /missing|invalid/);
  assert.throws(() => budgets.evaluatePerformance([report({ lcp: NaN }), report(), report()]), /missing|invalid/);
});

test("release gate checks independent medians without relaxing any approved threshold", () => {
  assert.ok(budgets, "performance release gate has not been implemented");
  assert.deepEqual(budgets.evaluatePerformance([report(), report(), report({ lcp: 10000 })]).failures, []);
  const bad = report({ performance: 0.84, accessibility: 0.94, lcp: 2501, tbt: 201, cls: 0.101 });
  assert.equal(budgets.evaluatePerformance([bad, bad, report()]).failures.length, 5);
});
