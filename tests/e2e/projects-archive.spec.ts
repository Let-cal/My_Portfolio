import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const chip = (page: Page, name: RegExp) =>
  page
    .getByRole("group", { name: "Filter projects by where they were done" })
    .getByRole("button", { name });
const visibleRows = (page: Page) => page.locator("tr[id^='row-']:visible");

/** True when the element's top sits inside the viewport. */
const inViewport = (page: Page, id: string) =>
  page.evaluate((id) => {
    const box = document.getElementById(id)!.getBoundingClientRect();
    return box.top >= 0 && box.top < window.innerHeight && box.height > 0;
  }, id);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("hello", "1"));
});

test("the home page links to the archive, which lists every project", async ({
  page,
}) => {
  await page.goto("/en");
  await page.getByRole("link", { name: /View all 8 projects/ }).click();
  await expect(page).toHaveURL(/\/en\/projects$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "All projects" }),
  ).toBeVisible();
  await expect(visibleRows(page)).toHaveCount(8);
});

test("filter + reload keeps the filter", async ({ page }) => {
  await page.goto("/en/projects");
  await chip(page, /^University/).click();
  await expect(page).toHaveURL(/\?kind=university$/);
  await expect(visibleRows(page)).toHaveCount(3);
  await page.reload();
  await expect(chip(page, /^University/)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(visibleRows(page)).toHaveCount(3);
  await expect(page.locator("#row-siteplus")).toBeVisible();
  await expect(page.locator("#row-skg-coa")).toBeHidden();
});

test("a shared ?kind= link filters without a layout shift", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[])
        if (!entry.hadRecentInput)
          (window as unknown as { __cls: number }).__cls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/en/projects?kind=work");
  await expect(chip(page, /^Work/)).toHaveAttribute("aria-pressed", "true");
  await expect(visibleRows(page)).toHaveCount(5);
  await page.waitForTimeout(500);
  const cls = await page.evaluate(
    () => (window as unknown as { __cls: number }).__cls,
  );
  expect(cls).toBeLessThan(0.01);
});

test("an unknown ?kind= shows every project", async ({ page }) => {
  await page.goto("/en/projects?kind=bogus");
  await expect(chip(page, /^All/)).toHaveAttribute("aria-pressed", "true");
  await expect(visibleRows(page)).toHaveCount(8);
});

test("a #row- deep link scrolls to the row, even when the filter would hide it", async ({
  page,
}) => {
  await page.goto("/en/projects?kind=university#row-tongue-ai-driver-ms");
  await expect(page.locator("#row-tongue-ai-driver-ms")).toBeVisible();
  await expect(chip(page, /^All/)).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => inViewport(page, "row-tongue-ai-driver-ms"))
    .toBe(true);
});

test("Enter on a project opens its case study", async ({ page }) => {
  await page.goto("/en/projects");
  const button = page.locator("#row-skg-coa").getByRole("button");
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(button).toBeFocused();
});

test("canonical and hreflang point at the archive in each language", async ({
  page,
}) => {
  await page.goto("/ja/projects");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/ja\/projects$/,
  );
  for (const locale of ["en", "ja", "vi"])
    await expect(
      page.locator(`link[rel="alternate"][hreflang="${locale}"]`),
    ).toHaveAttribute("href", new RegExp(`/${locale}/projects$`));
});

test("the archive has a share image for Open Graph and Twitter", async ({
  page,
  request,
}) => {
  await page.goto("/vi/projects");
  const og = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  expect(og).toMatch(/\/vi\/opengraph-image$/);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    "content",
    og!,
  );
  const image = await request.get(new URL(og!).pathname);
  expect(image.ok()).toBe(true);
  expect(image.headers()["content-type"]).toContain("image/png");
});

test("a section link in the navigation goes back to the home page at that section", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/en/projects?role=pm");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: /Skills/ })
    .click();
  await expect(page).toHaveURL(/\/en\?role=pm#skills$/);
  await expect(page.locator("#skills")).toBeAttached();
});

test("mobile 375px shows stacked rows without horizontal scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/en/projects");
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  // Stacked: the title cell sits below the year cell instead of beside it.
  const [year, title] = await page
    .locator("#row-skg-coa td")
    .evaluateAll((cells) =>
      cells.slice(0, 2).map((c) => c.getBoundingClientRect()),
    );
  expect(title.top).toBeGreaterThanOrEqual(year.bottom - 1);
  // Column headers stay for screen readers but take no visual space.
  const head = await page.locator("thead").evaluate((el) => {
    const box = el.getBoundingClientRect();
    return box.width * box.height;
  });
  expect(head).toBeLessThanOrEqual(1);
});

for (const theme of ["dark", "light"] as const) {
  test(`${theme} /en/projects passes axe`, async ({ page }) => {
    await page.addInitScript((theme) => {
      localStorage.setItem("theme", theme);
    }, theme);
    await page.goto("/en/projects");
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
