import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import sharp from "sharp";

for (const name of ["koi-day", "koi-night", "dragon-day", "dragon-night"]) {
  test(`${name} offers a smaller AVIF fallback with matching dimensions and bounded pixel error`, async () => {
    const jpeg = readFileSync(`public/fallback/${name}.jpg`);
    const avif = readFileSync(`public/fallback/${name}.avif`);
    assert.ok(avif.length < jpeg.length * 0.65);
    const original = await sharp(jpeg)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const optimized = await sharp(avif)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.deepEqual(optimized.info, original.info);
    let error = 0;
    for (let i = 0; i < original.data.length; i++)
      error += Math.abs(original.data[i] - optimized.data[i]);
    assert.ok(
      error / original.data.length < 2,
      "mean channel error must remain under 2/255",
    );
  });
}
