import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const origin = process.argv[2] ?? "http://localhost:3100";
const output = join(process.cwd(), "public", "fallback");
const variants = [
  ["koi", "night"],
  ["koi", "day"],
  ["dragon", "night"],
  ["dragon", "day"],
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=d3d11"],
});
try {
  for (const [creature, theme] of variants) {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: 1,
    });
    await page.goto(`${origin}/en?capture=${creature}&theme=${theme}`, {
      waitUntil: "load",
    });
    await page.waitForFunction(() => window.__sceneCaptureReady === true, {
      timeout: 45_000,
    });
    await page.waitForTimeout(350);
    const path = join(output, `${creature}-${theme}.jpg`);
    await page
      .locator("[data-koi-canvas]")
      .screenshot({ path, type: "jpeg", quality: 78 });
    const { size } = await stat(path);
    if (size > 180 * 1024)
      throw new Error(`${path} is ${size} bytes; the limit is 180 KB`);
    console.log(`${creature}-${theme}: ${(size / 1024).toFixed(1)} KB`);
    await page.close();
  }
} finally {
  await browser.close();
}
