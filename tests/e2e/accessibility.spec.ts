import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("static technology marquees can be scrolled with the keyboard", async ({
  page,
}) => {
  await page.goto("/en");
  const marquee = page.locator("#proj-siteplus .fx-marquee");
  await expect(marquee).toHaveAttribute("tabindex", "0");
  await marquee.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => marquee.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
});

test("selected certificate tab text has AA contrast against its actual accent fill", async ({
  page,
}) => {
  await page.goto("/en");
  const tab = page.locator('[role="tab"][aria-selected="true"]').first();
  await tab.scrollIntoViewIfNeeded();
  const ratio = await tab.evaluate((element) => {
    const foreground = getComputedStyle(element).color;
    const fill = element.querySelector('[aria-hidden="true"]')!;
    const background = getComputedStyle(fill).backgroundColor;
    const luminance = (color: string) => {
      const channels = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const fg = luminance(foreground),
      bg = luminance(background);
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

for (const theme of ["dark", "light"] as const) {
  for (const route of ["/en", "/ja", "/en/quick"]) {
    test(`${theme} ${route} passes the required accessibility audits`, async ({
      page,
    }) => {
      await page.addInitScript((theme) => {
        localStorage.setItem("theme", theme);
        sessionStorage.setItem("hello", "1");
      }, theme);
      await page.goto(route);
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
        .analyze();
      const blocking = violations.filter(
        ({ impact, id }) =>
          impact === "serious" ||
          impact === "critical" ||
          id === "heading-order" ||
          id === "label-content-name-mismatch",
      );
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    });
  }
}
