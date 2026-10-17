import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

test("generated manifests keep LF bytes in fresh Windows and Linux checkouts", () => {
  for (const file of ["src/app/fonts/manifest.json", "src/app/fonts/site-subsets.json"]) {
    const attribute = execFileSync("git", ["check-attr", "eol", "--", file], { encoding: "utf8" });
    assert.equal(attribute.trim(), `${file}: eol: lf`);
    assert.equal(readFileSync(file, "utf8").includes("\r"), false);
  }
});
