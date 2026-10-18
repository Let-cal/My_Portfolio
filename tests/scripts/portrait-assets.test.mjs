import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import sharp from "sharp";

test("role portraits use pre-encoded responsive AVIF with a bounded mobile transfer", async () => {
  const portraits = JSON.parse(readFileSync("src/content/role-portraits.json", "utf8"));
  for (const role of Object.values(portraits)) {
    assert.match(role.src, /\/optimized\/role-.*-772\.avif$/);
    for (const candidate of role.srcSet.split(", ")) {
      const [url, descriptor] = candidate.split(" ");
      const width = parseInt(descriptor, 10);
      const file = `public${url}`;
      const image = await sharp(file).metadata();
      assert.equal(image.width, width);
      assert.equal(image.format, "heif");
      if (width <= 512) assert.ok(statSync(file).size <= 45 * 1024, `${url} exceeds mobile budget`);
    }
  }
});
