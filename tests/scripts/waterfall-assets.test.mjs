import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

test("the waterfall uses bounded local 3D rocks with source provenance and no scenery image plate", () => {
  const dir = "public/scene/waterfall/rocks";
  const gltf = JSON.parse(readFileSync(join(dir, "rocks.gltf"), "utf8"));
  const provenance = JSON.parse(readFileSync(join(dir, "provenance.json"), "utf8"));
  assert.equal(provenance.license, "CC0-1.0");
  assert.equal(gltf.meshes.length, 3);
  for (const mesh of gltf.meshes) {
    assert.ok(gltf.accessors[mesh.primitives[0].indices].count / 3 <= 800);
    assert.ok(mesh.primitives[0].attributes.NORMAL !== undefined);
    assert.ok(mesh.primitives[0].attributes.TEXCOORD_0 !== undefined);
  }
  let bytes = 0;
  for (const file of ["rocks.gltf", "rocks.bin", "albedo.jpg", "normal.jpg", "cliff-albedo.jpg", "cliff-normal.jpg"]) bytes += statSync(join(dir, file)).size;
  assert.ok(bytes < 650 * 1024, `${bytes} exceeds the deferred environment asset budget`);
  assert.equal(existsSync("public/scene/waterfall/autumn-gorge.webp"), false);
  assert.equal(existsSync("src/scene/environment/props/waterfall-plate.ts"), false);
  for (const image of gltf.images) assert.ok(!image.uri.includes(":") && !image.uri.includes(".."));
});
