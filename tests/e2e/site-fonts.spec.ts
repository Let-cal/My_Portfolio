import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

type Subset = { family: string; file: string; sourceFile: string; codepoints: number[]; weights: [number, number] };

test("site font subsets render the original glyphs, spacing and variable weights exactly", async ({ page }) => {
  const rows: Subset[] = JSON.parse(readFileSync("src/app/fonts/site-subsets.json", "utf8"));
  await page.goto("/en");
  for (const row of rows) {
    const result = await page.evaluate(async row => {
      const original = new FontFace("OriginalCheck", 'url(/fonts/' + row.sourceFile + ')', { weight: row.weights.join(" ") });
      const subset = new FontFace("SubsetCheck", 'url(/fonts/' + row.file + ')', { weight: row.weights.join(" ") });
      await Promise.all([original.load(), subset.load()]);
      document.fonts.add(original); document.fonts.add(subset);
      try {
        const text = String.fromCodePoint(...row.codepoints) + " AV To fi ffi 0123456789 1,200.50";
        const draw = (family: string, weight: number) => {
          const canvas = document.createElement("canvas"); canvas.width = 8192; canvas.height = 96;
          const context = canvas.getContext("2d")!; context.font = weight + ' 32px "' + family + '"';
          context.fillText(text, 8, 60);
          return { width: context.measureText(text).width, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data, canvas };
        };
        return [row.weights[0], 400, 500, 700, row.weights[1]].map(weight => {
          const a = draw("OriginalCheck", weight), b = draw("SubsetCheck", weight);
          let changed = 0, maxDelta = 0, firstX = -1, lastX = -1;
          for (let i = 3; i < a.pixels.length; i += 4) {
            const delta = Math.abs(a.pixels[i] - b.pixels[i]);
            if (!delta) continue;
            changed++; maxDelta = Math.max(maxDelta, delta);
            const x = ((i - 3) / 4) % a.canvas.width;
            firstX = firstX < 0 ? x : Math.min(firstX, x); lastX = Math.max(lastX, x);
          }
          const equalPixels = a.pixels.every((value, i) => value === b.pixels[i]);
          return { weight, equalWidth: a.width === b.width, equalPixels,
            changed, maxDelta, firstX, lastX,
            originalPng: !equalPixels ? a.canvas.toDataURL() : null,
            subsetPng: !equalPixels ? b.canvas.toDataURL() : null };
        });
      } finally { document.fonts.delete(original); document.fonts.delete(subset); }
    }, row);
    for (const item of result) {
      if (!item.equalPixels) {
        for (const [kind, data] of [["original", item.originalPng], ["subset", item.subsetPng]] as const) {
          await test.info().attach(`${row.family}-${item.weight}-${kind}.png`, { body: Buffer.from(data!.split(",")[1], "base64"), contentType: "image/png" });
        }
      }
      expect(item.equalWidth, row.family + " width at " + item.weight).toBe(true);
      expect(item.equalPixels, `${row.family} glyphs at ${item.weight}: ${JSON.stringify({ changed: item.changed, maxDelta: item.maxDelta, firstX: item.firstX, lastX: item.lastX })}`).toBe(true);
    }
  }
});

for (const locale of ["en", "ja", "vi"]) {
  test(locale + ": initial page uses the smaller site Latin fonts without fetching full Latin", async ({ page }) => {
    const rows: Subset[] = JSON.parse(readFileSync("src/app/fonts/site-subsets.json", "utf8"));
    await page.setViewportSize({ width: 412, height: 823 });
    const fetched = new Set<string>();
    page.on("request", request => { if (request.resourceType() === "font") fetched.add(new URL(request.url()).pathname); });
    await page.goto("/" + locale);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    for (const row of rows) {
      expect(fetched.has("/fonts/" + row.file), row.family + " subset requested").toBe(true);
      expect(fetched.has("/fonts/" + row.sourceFile), row.family + " unnecessary full Latin").toBe(false);
    }
  });
}

test("new Latin characters outside the site subset still load the complete original face", async ({ page }) => {
  const rows: Subset[] = JSON.parse(readFileSync("src/app/fonts/site-subsets.json", "utf8"));
  const fetched = new Set<string>();
  page.on("request", request => { if (request.resourceType() === "font") fetched.add(new URL(request.url()).pathname); });
  await page.goto("/en");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  for (const row of rows) {
    expect(row.codepoints).not.toContain(0x00c6);
    expect(fetched.has("/fonts/" + row.sourceFile)).toBe(false);
    await page.evaluate(async family => {
      const node = document.createElement("span");
      node.style.fontFamily = '"' + family + '"';
      node.textContent = "Æ";
      document.body.append(node);
      await document.fonts.load('400 32px "' + family + '"', "Æ");
      await document.fonts.ready;
      node.remove();
    }, row.family);
    expect(fetched.has("/fonts/" + row.sourceFile), row.family + " full fallback remains available").toBe(true);
  }
});
