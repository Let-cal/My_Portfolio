import { expect, test } from "@playwright/test";

test("mobile defers offscreen rendering while native section navigation and printing retain content", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");
  await expect(page.locator("#skills").locator("..")).toHaveCSS("content-visibility", "auto");
  for (const id of ["skills", "experience", "contact", "projects"]) {
    await page.locator(`a[href='#${id}']:visible`).first().click();
    await expect.poll(() => page.locator(`#${id}`).evaluate(el => Math.abs(el.getBoundingClientRect().top - 56)), { message: id }).toBeLessThan(100);
    await expect(page.locator(`#${id} h2`)).toBeVisible();
  }
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#skills").locator("..")).toHaveCSS("content-visibility", "visible");
  await page.emulateMedia({ media: "screen" });
  await page.goto("/en#skills");
  await expect(page.locator("html")).toHaveAttribute("data-chapters-expanded", "");
  await expect.poll(() => page.locator("#skills").evaluate(el => Math.abs(el.getBoundingClientRect().top - 56))).toBeLessThan(100);
  await expect.poll(() => page.locator("#skills [data-skill-icon]").first().evaluate(el => (el as SVGGraphicsElement).getBBox().width)).toBeGreaterThan(0);
  await page.goto("/en#contact");
  await expect(page.locator("[data-koi-fallback]")).toHaveAttribute("src", "/fallback/dragon-night.jpg");
  await page.goto("/en#hero");
  await expect(page.locator("[data-koi-fallback]")).toHaveAttribute("src", "/fallback/koi-night.jpg");
});
