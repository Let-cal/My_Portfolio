import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The 墨の糸 ink thread of the desktop side rail (Emaki spec 5.5).
test.use({ viewport: { width: 1440, height: 900 } });

const RAIL = "aside nav";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("hello", "1"));
});

/** Scrolls so the section's top sits at 30% of the viewport, above the reading line. */
async function readSection(page: Page, id: string) {
  await page.evaluate((id) => {
    const top = document.getElementById(id)!.getBoundingClientRect().top;
    window.scrollTo(0, window.scrollY + top - window.innerHeight * 0.3);
  }, id);
}

/** Vertical centre of an element in viewport pixels. */
const centre = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  });

test("scrolling to Projects marks it current and puts the ink drop between Projects and the next chapter", async ({
  page,
}) => {
  await page.goto("/en");
  const root = page.locator(`${RAIL} [data-ink-root]`);
  await expect(root).toHaveAttribute("data-ink-ready", "");
  // The thread is drawn through every numeral.
  await expect(root.locator("svg.it-base path")).toHaveAttribute(
    "d",
    /^M[\d.]+ [\d.]+( C[\d. ]+){6}$/,
  );

  await readSection(page, "projects");
  const projects = page.locator(`${RAIL} a[data-chapter="projects"]`);
  await expect(projects).toHaveAttribute("aria-current", "true");
  await expect(page.locator(`${RAIL} [aria-current="true"]`)).toHaveCount(1);
  await expect(root).toHaveAttribute("data-inked", "");

  const top = await centre(
    page,
    `${RAIL} a[data-chapter="projects"] [data-numeral]`,
  );
  const next = await centre(
    page,
    `${RAIL} a[data-chapter="skills"] [data-numeral]`,
  );
  await expect
    .poll(() => centre(page, `${RAIL} [data-ink-drop]`))
    .toBeGreaterThanOrEqual(top - 1);
  expect(await centre(page, `${RAIL} [data-ink-drop]`)).toBeLessThanOrEqual(
    next + 1,
  );

  // Chapters already read have a full hairline; the active one is part-way.
  const fill = (id: string) =>
    page
      .locator(`${RAIL} a[data-chapter="${id}"]`)
      .evaluate((el) => Number(getComputedStyle(el).getPropertyValue("--sp")));
  await expect.poll(() => fill("experience")).toBe(1);
  const active = await fill("projects");
  expect(active).toBeGreaterThan(0);
  expect(active).toBeLessThan(1);
  expect(await fill("contact")).toBe(0);
});

test("the ink turns teal from 第五章 昇龍, like the top koi turning into a dragon", async ({
  page,
}) => {
  await page.goto("/en");
  const root = page.locator(`${RAIL} [data-ink-root]`);
  await expect(root).toHaveAttribute("data-ink-ready", "");
  await expect(root).not.toHaveAttribute("data-dragon", "");
  await readSection(page, "why");
  await expect(root).toHaveAttribute("data-dragon", "");
  await expect(page.locator('[data-icon="dragon"]')).toBeAttached();
});

test("peek card shows on hover and keyboard focus, hidden from assistive tech", async ({
  page,
}) => {
  await page.goto("/en");
  const link = page.locator(`${RAIL} a[data-chapter="skills"]`);
  const peek = link.locator("[data-peek]");
  await expect(peek).toHaveAttribute("aria-hidden", "true");
  await expect(peek).toHaveCSS("opacity", "0");
  await link.hover();
  await expect(peek).toHaveCSS("opacity", "1");
  await expect(peek).toContainText("第三章 技術");
  await page.mouse.move(1400, 880);
  await expect(peek).toHaveCSS("opacity", "0");
  await link.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  await expect(peek).toHaveCSS("opacity", "1");
  // The link is still named by its label alone.
  await expect(link).toHaveAccessibleName("Skills");
});

test("reduced motion: no transitions, but the drop is still placed", async ({
  page,
}) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  const drop = page.locator(`${RAIL} [data-ink-drop]`);
  await readSection(page, "experience");
  await expect(drop).toHaveCSS("transition-duration", "0s");
  await expect(drop).toHaveCSS("opacity", "1");
  await expect(drop).toHaveCSS("transform", /matrix/);
});

test("on the archive page the spur is inked and current", async ({ page }) => {
  await page.goto("/en/projects");
  const spur = page.locator(`${RAIL} a[href="/en/projects"]`);
  await expect(spur).toHaveAttribute("aria-current", "page");
  await expect(spur).toHaveAccessibleName("All projects");
  const colour = (selector: string) =>
    page
      .locator(selector)
      .evaluate((el) => getComputedStyle(el, "::before").borderLeftColor);
  const base = await page
    .locator(`${RAIL} .it-base path`)
    .evaluate((el) => getComputedStyle(el).stroke);
  expect(await colour(`${RAIL} a[href="/en/projects"]`)).not.toBe(base);
  // No section here, so no chapter is current and the drop stays hidden.
  await expect(page.locator(`${RAIL} [aria-current="true"]`)).toHaveCount(0);
});

for (const theme of ["dark", "light"] as const) {
  test(`${theme}: the rail passes axe with a peek card open`, async ({
    page,
  }) => {
    await page.addInitScript((theme) => {
      localStorage.setItem("theme", theme);
    }, theme);
    await page.goto("/en");
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await readSection(page, "projects");
    await expect(
      page.locator(`${RAIL} a[data-chapter="projects"]`),
    ).toHaveAttribute("aria-current", "true");
    await page.locator(`${RAIL} a[data-chapter="experience"]`).hover();
    const { violations } = await new AxeBuilder({ page })
      .include("aside")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();
    expect(violations.map(({ id, nodes }) => `${id} ×${nodes.length}`)).toEqual(
      [],
    );
  });
}

test("the rail causes no layout shift while the thread loads and follows the scroll", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { __railShift: number }).__railShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        sources?: { node?: Node }[];
      }[])
        if (
          entry.sources?.some(
            (s) => s.node && s.node.parentElement?.closest("aside"),
          )
        )
          (window as unknown as { __railShift: number }).__railShift +=
            entry.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/en");
  await expect(page.locator(`${RAIL} [data-ink-root]`)).toHaveAttribute(
    "data-ink-ready",
    "",
  );
  await readSection(page, "skills");
  await expect(
    page.locator(`${RAIL} a[data-chapter="skills"]`),
  ).toHaveAttribute("aria-current", "true");
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(
      () => (window as unknown as { __railShift: number }).__railShift,
    ),
  ).toBeLessThan(0.01);
});
