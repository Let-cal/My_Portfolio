import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { unicodePoints, subtractUnicodeRange } from "../../scripts/font-ranges.mjs";

test("vendored fonts preserve every original binary and Unicode range", () => {
  const css = readFileSync("src/app/fonts/vietnamese.css", "utf8");
  const manifest = JSON.parse(readFileSync("src/app/fonts/manifest.json", "utf8"));
  assert.equal(manifest.length, 10);
  for (const entry of manifest) {
    const data = readFileSync(`public/fonts/${entry.file}`);
    assert.equal(data.length, entry.bytes);
    assert.equal(createHash("sha256").update(data).digest("hex"), entry.sha256);
    assert.ok(entry.file.includes(entry.sha256.slice(0, 8)));
    assert.ok(css.includes(`/fonts/${entry.file}`));
    assert.ok(css.includes(`unicode-range:${entry.effectiveUnicodeRange ?? entry.unicodeRange}`));
  }
});

test("Vietnamese no longer overlaps Latin Extended and total Unicode coverage is unchanged", () => {
  const rows = JSON.parse(readFileSync("src/app/fonts/manifest.json", "utf8"));
  const sites = JSON.parse(readFileSync("src/app/fonts/site-subsets.json", "utf8"));
  for (const family of ["Inter", "Space Grotesk"]) {
    const own = rows.filter(row => row.family === family);
    const original = new Set(own.flatMap(row => [...unicodePoints(row.unicodeRange)]));
    const effective = new Set(own.flatMap(row => [...unicodePoints(row.effectiveUnicodeRange ?? row.unicodeRange)]));
    for (const site of sites.filter(row => row.family === family)) {
      for (const point of site.codepoints) effective.add(point);
    }
    assert.deepEqual(effective, original);
    const vietnamese = unicodePoints(own.find(row => row.unicodeRange.includes("1ea0-1ef9")).unicodeRange);
    const extended = unicodePoints(own.find(row => row.unicodeRange.startsWith("u+0100-02ba")).effectiveUnicodeRange);
    assert.equal([...extended].some(point => vietnamese.has(point)), false);
  }
});

test("original Latin CSS ranges exclude exactly the site points and retain every other original point", () => {
  const rows = JSON.parse(readFileSync("src/app/fonts/manifest.json", "utf8"));
  const sites = JSON.parse(readFileSync("src/app/fonts/site-subsets.json", "utf8"));
  const css = readFileSync("src/app/fonts/vietnamese.css", "utf8");
  const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(match => match[1]);
  for (const site of sites) {
    const original = rows.find(row => row.file === site.sourceFile);
    assert.ok(original.effectiveUnicodeRange, `${site.family}: missing effective Latin range`);
    const expected = unicodePoints(subtractUnicodeRange(original.unicodeRange, site.unicodeRange));
    const effective = unicodePoints(original.effectiveUnicodeRange);
    assert.deepEqual(effective, expected);
    assert.equal(site.codepoints.some(point => effective.has(point)), false);
    const face = faces.find(face => face.includes(`/fonts/${original.file})`));
    assert.ok(face.includes(`unicode-range:${original.effectiveUnicodeRange}`));
    assert.ok(faces.find(face => face.includes(`/fonts/${site.file})`)).includes(`unicode-range:${site.unicodeRange}`));
  }
});

test("Vietnamese is the final matching face within each original font family", () => {
  const css = readFileSync("src/app/fonts/vietnamese.css", "utf8");
  for (const family of ["Inter", "Space Grotesk"]) {
    const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(match => match[1]).filter(face => face.includes(`font-family:${family};`));
    assert.ok(faces.length >= 3);
    assert.ok(faces.at(-1).includes("1ea0-1ef9"));
    assert.ok(faces.every(face => face.includes("font-display:optional")));
  }
  assert.ok(css.includes("ascent-override:90.44%"));
  assert.ok(css.includes("ascent-override:89.71%"));
});
