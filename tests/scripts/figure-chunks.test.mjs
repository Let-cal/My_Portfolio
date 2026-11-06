import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { measureFigureChunks } from "../../scripts/measure-initial-js.mjs";

const script = fileURLToPath(
  new URL("../../scripts/measure-initial-js.mjs", import.meta.url),
);

const SCROLL = "static/chunks/9542.figures.js";
const VIEWER = "static/chunks/9699.viewer.js";

// Random bytes do not compress, so N KB of them is about N KB gzip.
function fixture(scrollKB, viewerKB, run) {
  const root = mkdtempSync(join(tmpdir(), "letcal-figures-"));
  try {
    mkdirSync(join(root, ".next/static/chunks"), { recursive: true });
    mkdirSync(join(root, ".next/static/css"), { recursive: true });
    writeFileSync(join(root, ".next", SCROLL), randomBytes(scrollKB * 1024));
    writeFileSync(join(root, ".next", VIEWER), randomBytes(viewerKB * 1024));
    writeFileSync(join(root, ".next/static/css/viewer.css"), "a{}");
    writeFileSync(
      join(root, ".next/react-loadable-manifest.json"),
      JSON.stringify({
        "components\\sections\\case-study\\figures\\LazyFigureScroll.tsx -> ./FigureScroll":
          { id: 1, files: [SCROLL] },
        "components\\sections\\case-study\\figures\\LazyFigureViewer.tsx -> ./FigureViewer":
          { id: 2, files: ["static/css/viewer.css", VIEWER] },
      }),
    );
    run(root);
  } finally {
    rmSync(root, { recursive: true });
  }
}

test("a figures chunk above 25 KB gzip fails and names the chunk", () =>
  fixture(26, 5, (root) => {
    const [scroll, viewer] = measureFigureChunks(root);
    assert.equal(scroll.label, "figures");
    assert.equal(scroll.ok, false);
    assert.match(scroll.error, /9542\.figures\.js/);
    assert.equal(viewer.label, "figure viewer");
    assert.equal(viewer.ok, true);
  }));

test("figure chunks at 24 KB gzip pass, CSS is not counted", () =>
  fixture(24, 24, (root) => {
    const results = measureFigureChunks(root);
    assert.deepEqual(
      results.map(({ ok }) => ok),
      [true, true],
    );
    assert.deepEqual(results[1].files, [VIEWER]);
    assert.ok(results[0].gzip > 23 * 1024 && results[0].gzip < 25 * 1024);
  }));

test("a build without the figure entries fails rather than passing silently", () => {
  const root = mkdtempSync(join(tmpdir(), "letcal-figures-"));
  try {
    mkdirSync(join(root, ".next"), { recursive: true });
    writeFileSync(join(root, ".next/react-loadable-manifest.json"), "{}");
    const results = measureFigureChunks(root);
    assert.deepEqual(
      results.map(({ ok }) => ok),
      [false, false],
    );
    assert.match(results[0].error, /FigureScroll/);
    assert.equal(measureFigureChunks(join(root, "missing"))[0].ok, false);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("the default bundle check prints both figure budgets and fails above them", () =>
  fixture(26, 5, (root) => {
    mkdirSync(join(root, ".next/server/app/en"), { recursive: true });
    for (const route of ["en", "ja", "vi", "en/quick", "en/projects"])
      writeFileSync(join(root, ".next/server/app", `${route}.html`), "");
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /^figures: 26\.0 KB gzip \(budget 25 KB\)$/m);
    assert.match(
      result.stdout,
      /^figure viewer: 5\.0 KB gzip \(budget 25 KB\)$/m,
    );
    assert.match(result.stderr, /9542\.figures\.js/);
  }));
