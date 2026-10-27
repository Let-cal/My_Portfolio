import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const toggle = (page: Page, anchor: string) =>
  page.locator(`#${anchor} button[aria-expanded]`).first();

/** True when the element's top sits inside the viewport. */
const inViewport = (page: Page, id: string) =>
  page.evaluate((id) => {
    const box = document.getElementById(id)!.getBoundingClientRect();
    return box.top >= 0 && box.top < window.innerHeight && box.height > 0;
  }, id);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("hello", "1"));
});

test("newest parent is open and older parents are collapsed with a chip", async ({
  page,
}) => {
  await page.goto("/en");
  await expect(toggle(page, "exp-skg-software")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator("#tree-skg-ai-agent")).toBeVisible();
  await expect(toggle(page, "exp-fpt-university")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(toggle(page, "exp-fpt-university")).toContainText("3 projects");
  await expect(page.locator("#tree-siteplus")).toBeHidden();
});

test("keyboard: Enter and Space toggle a parent and focus stays on its button", async ({
  page,
}) => {
  await page.goto("/en");
  const button = toggle(page, "exp-fpt-university");
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#tree-siteplus")).toBeVisible();
  await expect(button).toBeFocused();
  await page.keyboard.press("Space");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#tree-siteplus")).toBeHidden();
  await expect(button).toBeFocused();
});

test("hash #tree-siteplus expands FPT University and scrolls to the card", async ({
  page,
}) => {
  await page.goto("/en#tree-siteplus");
  await expect(toggle(page, "exp-fpt-university")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator("#tree-siteplus")).toBeVisible();
  await expect.poll(() => inViewport(page, "tree-siteplus")).toBe(true);
});

test("hash #exp-fpt-japan expands that parent and scrolls to it", async ({
  page,
}) => {
  await page.goto("/en#exp-fpt-japan");
  await expect(toggle(page, "exp-fpt-japan")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect.poll(() => inViewport(page, "exp-fpt-japan")).toBe(true);
});

test("a skill evidence link to a collapsed child expands its parent", async ({
  page,
}) => {
  await page.goto("/en");
  await page
    .locator('[data-skill-chip][data-skill-name="Flutter"]')
    .first()
    .click();
  await page.locator('#skills-evidence a[href="#tree-zodiacgems"]').click();
  await expect(toggle(page, "exp-fpt-university")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect.poll(() => inViewport(page, "tree-zodiacgems")).toBe(true);
});

test("case study opens from a child card", async ({ page }) => {
  await page.goto("/en");
  await page
    .locator("#tree-skg-coa")
    .getByRole("button", { name: /COA/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("reduced motion renders without animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en");
  const panel = page.locator("#exp-fpt-university [data-journey-panel]");
  await expect(panel).toHaveCSS("transition-duration", "0s");
  await toggle(page, "exp-fpt-university").click();
  // Fully open on the very next frame: no height or opacity tween.
  const opacity = await panel.evaluate(
    (el) =>
      new Promise<string>((resolve) =>
        requestAnimationFrame(() => resolve(getComputedStyle(el).opacity)),
      ),
  );
  expect(opacity).toBe("1");
});

test("motion on: the panel animates its height and opacity", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => localStorage.setItem("motion", "on"));
  await page.goto("/en");
  const panel = page.locator("#exp-fpt-university [data-journey-panel]");
  await expect(panel).not.toHaveCSS("transition-duration", "0s");
});

for (const theme of ["dark", "light"] as const) {
  test(`${theme} /en#experience passes axe with every parent open`, async ({
    page,
  }) => {
    await page.addInitScript((theme) => {
      localStorage.setItem("theme", theme);
    }, theme);
    await page.goto("/en#experience");
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    for (const anchor of ["exp-fpt-university", "exp-fpt-japan"])
      await toggle(page, anchor).click();
    const { violations } = await new AxeBuilder({ page })
      .include("#experience")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();
    const blocking = violations.filter(
      ({ impact, id }) =>
        impact === "serious" || impact === "critical" || id === "heading-order",
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}
