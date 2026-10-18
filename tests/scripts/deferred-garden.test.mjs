import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

test("waterfall model construction is in a separate deferred chunk from the initial 3D scene", () => {
  const dir = ".next/static/chunks";
  const chunks = readdirSync(dir).filter(name => name.endsWith(".js")).map(name => ({ name, source: readFileSync(join(dir, name), "utf8") }));
  const entry = chunks.filter(chunk => chunk.source.includes("waterfall-garden"));
  const garden = chunks.filter(chunk => chunk.source.includes("waterfall-cliff"));
  assert.equal(entry.length, 1); assert.equal(garden.length, 1);
  assert.notEqual(entry[0].name, garden[0].name);
  assert.equal(entry[0].source.includes("waterfall-cliff"), false);
});
