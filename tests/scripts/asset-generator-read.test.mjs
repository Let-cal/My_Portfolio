import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
const root = process.cwd();
test("manual generators handle absent outputs and validate their own generated files", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "letcal-assets-"));
  try {
    mkdirSync(join(cwd, "public/fallback"), { recursive: true });
    mkdirSync(join(cwd, "public/images"), { recursive: true });
    const names = ["koi-day", "koi-night", "dragon-day", "dragon-night"];
    for (const name of names)
      copyFileSync(
        join(root, "public/fallback", name + ".jpg"),
        join(cwd, "public/fallback", name + ".jpg"),
      );
    const commands = [
      [resolve(root, "scripts/generate-fallback-formats.mjs")],
      [
        resolve(root, "node_modules/tsx/dist/cli.mjs"),
        "--tsconfig",
        resolve(root, "tsconfig.json"),
        resolve(root, "scripts/generate-skill-sprite.ts"),
      ],
    ];
    for (const args of commands) {
      const run = spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
      assert.equal(run.status, 0, run.stderr);
      const check = spawnSync(process.execPath, [...args, "--check"], {
        cwd,
        encoding: "utf8",
      });
      assert.equal(check.status, 0, check.stderr);
    }
    for (const name of names) {
      const jpeg = readFileSync(join(cwd, "public/fallback", name + ".jpg"));
      const avif = readFileSync(join(cwd, "public/fallback", name + ".avif"));
      const original = await sharp(jpeg)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const generated = await sharp(avif)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      assert.deepEqual(generated.info, original.info);
      assert.ok(avif.length < jpeg.length * 0.65);
      let error = 0;
      for (let i = 0; i < original.data.length; i++)
        error += Math.abs(original.data[i] - generated.data[i]);
      assert.ok(error / original.data.length < 2);
    }
    assert.deepEqual(
      readFileSync(join(cwd, "public/images/skill-sprite.svg")),
      readFileSync(join(root, "public/images/skill-sprite.svg")),
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
test("production mode preserves committed AVIF bytes instead of re-encoding for the build platform", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "letcal-committed-assets-"));
  try {
    mkdirSync(join(cwd, "public/fallback"), { recursive: true });
    const names = ["koi-day", "koi-night", "dragon-day", "dragon-night"];
    const expected = new Map();
    for (const name of names) {
      copyFileSync(
        join(root, "public/fallback", name + ".jpg"),
        join(cwd, "public/fallback", name + ".jpg"),
      );
      const bytes = await sharp(join(root, "public/fallback", name + ".avif"))
        .avif({ quality: 64, effort: 0 })
        .toBuffer();
      expected.set(name, bytes);
      await import("node:fs").then((fs) =>
        fs.writeFileSync(join(cwd, "public/fallback", name + ".avif"), bytes),
      );
    }
    const run = spawnSync(
      process.execPath,
      [
        resolve(root, "scripts/generate-fallback-formats.mjs"),
        "--use-committed",
      ],
      { cwd, encoding: "utf8" },
    );
    assert.equal(run.status, 0, run.stderr);
    for (const name of names)
      assert.ok(
        readFileSync(join(cwd, "public/fallback", name + ".avif")).equals(
          expected.get(name),
        ),
        `${name} must retain committed bytes`,
      );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
