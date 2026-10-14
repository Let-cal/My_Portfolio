import { expect, test } from "@playwright/test";

test.describe("motion preference and scene fallbacks", () => {
  test("the mobile greeting leaves the hero portrait unobstructed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");
    const hit = await page.locator(".hero-disc").evaluate((element) => {
      const box = element.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return top !== null && !top.closest("[data-hello]");
    });
    expect(hit).toBe(true);
  });
  test("reduced motion keeps the 3D canvas off and shows a static fallback", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("[data-koi-fallback]")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("mobile does not mount the canvas before the visitor interacts", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");
    await expect(page.locator("[data-koi-fallback]")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("Motion on overrides OS reduce and canvas never catches page controls", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("motion", "on"));
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
    await expect(page.locator("[data-koi-canvas] canvas")).toHaveCount(1, { timeout: 20_000 });

    for (const selector of ["#hero a", "#why article"]) {
      const target = page.locator(selector).first();
      await target.scrollIntoViewIfNeeded();
      await expect.poll(() => target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit !== null && element.contains(hit);
      }), { message: `${selector} must remain the hit target above the canvas` }).toBe(true);
    }

    const japanese = page.getByRole("button", { name: "日本語 (JA)" });
    await expect(japanese).toBeVisible();
    await japanese.click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  });
});
