import { expect, test } from "@playwright/test";

test("Vietnamese text uses the original small subsets instead of overlapping Latin Extended files", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 823 });
  const fonts = new Set<string>();
  page.on("request", request => { if (request.resourceType() === "font") fonts.add(request.url()); });
  await page.goto("/vi");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const result = await page.evaluate(() => {
    const loaded = [...document.fonts].filter(font => font.status === "loaded").map(font => font.family.replaceAll('"', ""));
    const extended: string[] = [];
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const family = rule.style.getPropertyValue("font-family").replaceAll('"', "");
        const range = rule.style.getPropertyValue("unicode-range");
        if (["Inter", "Space Grotesk"].includes(family) && /U\+1D00-1DBF/i.test(range)) {
          const src = rule.style.getPropertyValue("src").match(/url\(["']?([^"')]+)/)?.[1];
          if (src) extended.push(new URL(src, sheet.href ?? location.href).href);
        }
      }
    }
    return { loaded, extended };
  });
  expect(result.loaded).toContain("Inter");
  expect(result.loaded).toContain("Space Grotesk");
  expect(result.extended).toHaveLength(2);
  for (const url of result.extended) expect(fonts.has(url), `unnecessary font ${url}`).toBe(false);
});
