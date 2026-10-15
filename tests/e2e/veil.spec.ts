import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  test(`${theme}: moving Why cards and hero marquee never stretch the text backdrop across the sidebar`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 768 });
    await page.addInitScript((theme) => {
      Object.defineProperty(navigator, "hardwareConcurrency", { value: 4 });
      localStorage.setItem("theme", theme);
      localStorage.setItem("motion", "on");
      sessionStorage.setItem("hello", "1");
    }, theme);
    await page.goto("/vi?role=pm");
    await expect(page.locator("[data-koi-veil]>i").first()).toBeAttached({ timeout: 20_000 });
    await page.locator("#why").evaluate((el) => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top + 160));
    const noOversizedPanels = async () => page.evaluate(() => {
      const main = document.querySelector("main")!.getBoundingClientRect();
      return [...document.querySelectorAll("[data-koi-veil]>i")].every((panel) => {
        if (getComputedStyle(panel).display === "none") return true;
        const box = panel.getBoundingClientRect();
        // 24px soft padding is allowed; no rectangle may bridge both columns.
        return !(box.left < main.left - 24 && box.right > main.left + 24);
      });
    });
    for (let step = 0; step < 3; step++) {
      await expect.poll(noOversizedPanels).toBe(true);
      await expect(page.locator("#why [data-why-card][data-scene-veil=off]")).toHaveCount(4);
      if (step < 2) {
        await page.locator('#why [aria-roledescription="carousel"]').press("ArrowRight");
        await page.waitForTimeout(850);
      }
    }
    await page.locator(".hero-stroke-text").first().evaluate((el) => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 400));
    await expect.poll(noOversizedPanels).toBe(true);
    expect(await page.locator(".hero-stroke-text").first().evaluate((el) => !!el.closest("[data-scene-ignore]"))).toBe(true);
  });
}
