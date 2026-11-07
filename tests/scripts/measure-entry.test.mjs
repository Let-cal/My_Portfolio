import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isEntryPoint } from "../../scripts/measure-initial-js.mjs";

const script = fileURLToPath(
  new URL("../../scripts/measure-initial-js.mjs", import.meta.url),
);

test("the bundle check runs when started through a linked directory (real paths are compared)", () => {
  const dir = mkdtempSync(join(tmpdir(), "measure-entry-"));
  const cwd = mkdtempSync(join(tmpdir(), "measure-cwd-"));
  const link = join(dir, "scripts");
  // A junction needs no privileges on Windows; elsewhere a plain directory symlink.
  symlinkSync(
    dirname(script),
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  try {
    const result = spawnSync(
      process.execPath,
      [join(link, "measure-initial-js.mjs"), "no-such-route"],
      { cwd, encoding: "utf8" },
    );
    // main() ran: no build in this directory, so it reports the missing route and fails.
    assert.match(result.stderr, /\/no-such-route: no production HTML/);
    assert.equal(result.status, 1);
  } finally {
    unlinkSync(link);
    rmSync(dir, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("isEntryPoint compares real paths, case-folded on Windows", () => {
  const url = pathToFileURL(script).href;
  assert.equal(isEntryPoint(script, url), true);
  assert.equal(
    isEntryPoint(
      join(dirname(script), "..", "scripts", "measure-initial-js.mjs"),
      url,
    ),
    true,
  );
  if (process.platform === "win32")
    assert.equal(isEntryPoint(script.toLowerCase(), url), true);
  assert.equal(
    isEntryPoint(join(dirname(script), "check-performance.mjs"), url),
    false,
  );
  assert.equal(isEntryPoint(join(dirname(script), "missing.mjs"), url), false);
  assert.equal(isEntryPoint(undefined, url), false);
});
