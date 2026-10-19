import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import sharp from "sharp";

test("the favicon contains valid 32, 48 and 64 pixel PNG entries", async () => {
  const icon = readFileSync("src/app/favicon.ico");
  assert.equal(icon.readUInt16LE(0), 0);
  assert.equal(icon.readUInt16LE(2), 1);
  assert.equal(icon.readUInt16LE(4), 3);
  for (const [index, size] of [32, 48, 64].entries()) {
    const entry = 6 + index * 16;
    const length = icon.readUInt32LE(entry + 8),
      offset = icon.readUInt32LE(entry + 12);
    assert.equal(icon[entry], size);
    assert.ok(offset + length <= icon.length);
    const image = await sharp(
      icon.subarray(offset, offset + length),
    ).metadata();
    assert.equal(image.width, size);
    assert.equal(image.height, size);
    assert.equal(image.format, "png");
  }
});

test(
  "the share image's local koi is included in the deployment file trace",
  {
    skip: !existsSync(
      ".next/server/app/[locale]/opengraph-image/route.js.nft.json",
    ),
  },
  () => {
    const trace = JSON.parse(
      readFileSync(
        ".next/server/app/[locale]/opengraph-image/route.js.nft.json",
        "utf8",
      ),
    );
    assert.ok(
      trace.files.some((file) =>
        file.endsWith("public/fallback/koi-night.jpg"),
      ),
    );
  },
);
