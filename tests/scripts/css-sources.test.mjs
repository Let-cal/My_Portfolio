import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

test("Tailwind scans application source rather than documentation and test fixtures", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /@import "tailwindcss" source\("\.\.\/"\);/);
});
