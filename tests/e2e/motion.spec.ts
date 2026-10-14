import { expect, test } from "@playwright/test";

test.describe("motion preference and scene fallbacks", () => {
  test("Japanese body-font CSS loads on interaction rather than initial mobile rendering", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const styles: Promise<boolean>[] = [];
    page.on("response", (response) => {
      if (response.request().resourceType() === "stylesheet") styles.push(response.text().then((source) => source.includes("font-family:Noto Sans JP;")));
    });
    await page.goto("/ja");
    await page.waitForTimeout(1500);
    expect((await Promise.all(styles)).some(Boolean)).toBe(false);
    await page.mouse.wheel(0, 200);
    await expect.poll(async () => (await Promise.all(styles)).some(Boolean)).toBe(true);
  });
  test("mobile hydration does not fetch desktop smooth-scrolling code", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });
    const scripts: Promise<boolean>[] = [];
    page.on("response", (response) => {
      if (response.request().resourceType() === "script") scripts.push(response.text().then((source) => source.includes("data-lenis-prevent")));
    });
    await page.goto("/en");
    await page.waitForTimeout(2500);
    expect((await Promise.all(scripts)).some(Boolean)).toBe(false);
  });
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

  test("mobile keeps the static scene after idle and interaction", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");
    await expect(page.locator("[data-koi-fallback]")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
    await expect(page.locator("canvas")).toHaveCount(0);
    await page.waitForTimeout(3500);
    await page.mouse.click(20, 150);
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
