import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const chip = (page: Page, name: RegExp) =>
  page
    .getByRole("group", { name: "Filter projects by where they were done" })
    .getByRole("button", { name });
const visibleRows = (page: Page) => page.locator("li[id^='row-']:visible");
const year = (page: Page, y: string) =>
  page.locator(`section[data-archive-year="${y}"]`);

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
  await expect(page.getByText("8 projects · 2023 – 2026")).toBeVisible();
  await expect(visibleRows(page)).toHaveCount(8);
  // Year groups, newest first, each named by its year.
  await expect(page.getByRole("region")).toHaveText(
    ["2026", "2025", "2024", "2023"].map((y) => new RegExp(`^${y}`)),
  );
});

test("filter chips change the visible rows and hide empty years", async ({
  page,
}) => {
  await page.goto("/en/projects");
  await chip(page, /^University/).click();
  await expect(visibleRows(page)).toHaveCount(3);
  await expect(year(page, "2026")).toBeHidden();
  for (const y of ["2025", "2024", "2023"])
    await expect(year(page, y)).toBeVisible();
  await expect(chip(page, /^University/)).toBeFocused();

  await chip(page, /^Work/).click();
  await expect(visibleRows(page)).toHaveCount(5);
  for (const y of ["2024", "2023"]) await expect(year(page, y)).toBeHidden();
  for (const y of ["2026", "2025"]) await expect(year(page, y)).toBeVisible();

  await chip(page, /^All/).click();
  await expect(visibleRows(page)).toHaveCount(8);
  await expect(page.locator("section[data-archive-year]:visible")).toHaveCount(
    4,
  );
});

test("a reload with ?kind=university shows no flash: rows and empty years are hidden before any script loads", async ({
  page,
}) => {
  // No client chunks at all: only the server HTML and its inline pre-paint script decide what shows.
  await page.route("**/_next/static/chunks/**", (route) => route.abort());
  await page.goto("/en/projects?kind=university");
  await expect(page.locator("[data-archive-rows]")).toHaveAttribute(
    "data-archive-filter",
    "university",
  );
  await expect(visibleRows(page)).toHaveCount(3);
  await expect(year(page, "2026")).toBeHidden();
  await expect(year(page, "2025")).toBeVisible();
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
  // A slow CPU (as on the Linux CI runners) makes the optional Inter face miss the first paint, so any stylesheet
  // added after hydration that re-resolves fonts would swap it in and shift the table.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
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

test("the archive loads no late font stylesheet (it would re-resolve the optional fonts and shift the text)", async ({
  page,
}) => {
  const fontCss: string[] = [];
  page.on("response", async (response) => {
    if (!/\.css(\?|$)/.test(response.url())) return;
    const css = await response.text().catch(() => "");
    if (css.includes("@font-face")) fontCss.push(response.url());
  });
  await page.goto("/en/projects?kind=work");
  await expect(chip(page, /^Work/)).toHaveAttribute("aria-pressed", "true");
  await page.waitForLoadState("networkidle");
  // The Shippori Mincho faces belong to the vertical chapter labels, which only the home page has.
  expect(fontCss).toEqual([]);
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
  // Stacked: the "where" block sits below the title block instead of beside it, and the year above the rows.
  const [main, where] = await page
    .locator("#row-skg-coa")
    .evaluate((row) =>
      [".pa-main", "[data-where]"].map((s) =>
        row.querySelector(s)!.getBoundingClientRect(),
      ),
    );
  expect(where.top).toBeGreaterThanOrEqual(main.bottom - 1);
  const head = await year(page, "2025")
    .locator("[data-year-head]")
    .boundingBox();
  const row = await page.locator("#row-skg-coa").boundingBox();
  expect(row!.y).toBeGreaterThanOrEqual(head!.y + head!.height - 1);
});

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("filtering animates to the same result, a hover preview follows a row, and the title morphs into the panel", async ({
    page,
  }) => {
    await page.goto("/en/projects");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
    await chip(page, /^University/).click();
    await expect(visibleRows(page)).toHaveCount(3);
    await expect(year(page, "2026")).toBeHidden();
    await chip(page, /^All/).click();
    await expect(visibleRows(page)).toHaveCount(8);

    // A decorative card that follows the pointer over a row.
    const preview = page.locator("[data-archive-preview]");
    const row = page.locator("#row-zodiacgems");
    await row.scrollIntoViewIfNeeded();
    const box = (await row.boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + box.height / 2);
    await page.mouse.move(box.x + 60, box.y + box.height / 2);
    await expect(preview).toHaveAttribute("data-on", "");
    await expect(preview).toHaveAttribute("aria-hidden", "true");
    await expect(preview).toHaveText("ZodiacGems");
    await page.mouse.move(2, 2);
    await expect(preview).not.toHaveAttribute("data-on", "");

    // Opening a case study: the dialog opens and no view-transition name is left behind.
    const button = page.locator("#row-skg-coa").getByRole("button");
    await button.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /COA/ })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>("*")].some(
            (el) => el.style.viewTransitionName,
          ),
        ),
      )
      .toBe(false);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
  });
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
