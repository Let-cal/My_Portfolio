import test from "node:test";
import assert from "node:assert/strict";
import { ESLint } from "eslint";

test("lint excludes captured production bundles while retaining application source", async () => {
  const eslint = new ESLint();
  assert.equal(await eslint.isPathIgnored(".lighthouseci/startup-scripts/captured.js"), true);
  assert.equal(await eslint.isPathIgnored("src/components/fx/LocalTime.tsx"), false);
});
