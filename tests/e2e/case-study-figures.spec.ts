import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Waits until React has attached its handlers to the element (a click before that would be lost). */
async function hydrated(page: Page, selector: string) {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps$"));
  }, selector);
}

const panel = (page: Page) => page.locator("[data-case-panel]");

/** Stage, caption and filmstrip are stacked without overlap: nothing covers the caption or the strip. */
async function stacked(page: Page) {
  const stage = (await panel(page).getByRole("tabpanel").boundingBox())!;
  const caption = (await panel(page)
    .getByText(FIRST, { exact: true })
    .boundingBox())!;
  const strip = (await panel(page).getByRole("tablist").boundingBox())!;
  const foot = (await panel(page).locator("footer").boundingBox())!;
  expect(stage.y + stage.height).toBeLessThanOrEqual(caption.y + 0.5);
  expect(caption.y + caption.height).toBeLessThanOrEqual(strip.y + 0.5);
  expect(strip.y + strip.height).toBeLessThanOrEqual(foot.y + 0.5);
  return stage;
}
const tabs = (page: Page) => panel(page).getByRole("tab");

/** The seed project SitePlus has two figures: a screen (image) and an architecture diagram. */
const FIRST = "Mobile site-survey screen";
const SECOND = "How the client, API and database connect";

test("opens SitePlus from the archive, switches to figures and walks them with the arrow keys", async ({
  page,
}) => {
  await page.goto("/en/projects");
  await hydrated(page, "#row-siteplus button");
  await page.locator("#row-siteplus").getByRole("button").click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("SitePlus");
  const figures = panel(page).getByRole("button", { name: "Figures · 2" });
  await figures.click();
  await expect(figures).toHaveAttribute("aria-pressed", "true");
  await expect(tabs(page)).toHaveCount(2);
  await expect(tabs(page).first()).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/case=siteplus&fig=1$/);
  await page.keyboard.press("ArrowRight");
  await expect(tabs(page).nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/case=siteplus&fig=2$/);
  // Still SitePlus: in the figures view the arrows move figures, not projects.
  await expect(page.getByRole("dialog")).toHaveAccessibleName("SitePlus");
  await expect(panel(page)).toContainText("図 二／二");
  await panel(page).getByRole("button", { name: "Content" }).click();
  await expect(page).toHaveURL(/case=siteplus$/);
});

test("?case=siteplus&fig=2 opens on figure 2", async ({ page }) => {
  await page.goto("/en/projects?case=siteplus&fig=2");
  await expect(tabs(page).nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(
    panel(page).getByRole("tabpanel").getByRole("img"),
  ).toHaveAccessibleName(/Client calls API/);
  await page.reload();
  await expect(tabs(page).nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(panel(page).getByText(SECOND, { exact: true })).toBeVisible();
});

test("dark theme fetches only the dark rendering of a diagram", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto("/en/projects?case=siteplus&fig=2");
  await expect(
    panel(page).getByRole("tabpanel").getByRole("img"),
  ).toHaveAttribute("src", /seed-diagram-dark\.svg$/);
  await page.waitForLoadState("networkidle");
  expect(requested.some((url) => url.endsWith("seed-diagram-dark.svg"))).toBe(
    true,
  );
  expect(requested.some((url) => url.endsWith("seed-diagram-light.svg"))).toBe(
    false,
  );
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`fit: the figures view is wide at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/en/projects?case=siteplus&fig=1");
    await expect(tabs(page)).toHaveCount(2);
    const content = page.locator("[data-case-content]");
    await page.evaluate(() => document.fonts.ready);
    const m = await content.evaluate(
      (el) =>
        new Promise<{ mode: string; scroll: number; client: number }>(
          (resolve) =>
            requestAnimationFrame(() =>
              resolve({
                mode: el.getAttribute("data-mode") ?? "",
                scroll: el.scrollHeight,
                client: el.clientHeight,
              }),
            ),
        ),
    );
    console.log(
      `[figures fit ${viewport.width}x${viewport.height}] ${m.mode} ${m.scroll}/${m.client}`,
    );
    expect(m.mode).toBe("wide");
    expect(m.scroll).toBeLessThanOrEqual(m.client + 1);
    // The stage gets its height from the panel, and caption and filmstrip are on screen below it.
    const stage = await stacked(page);
    expect(stage.height).toBeGreaterThanOrEqual(240);
    await expect(
      panel(page).getByText(FIRST, { exact: true }),
    ).toBeInViewport();
    await expect(panel(page).getByRole("tablist")).toBeInViewport();
  });
}

test("figures in scroll mode keep caption and strip visible at 375x740", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto("/en/projects?case=siteplus&fig=1");
  const content = page.locator("[data-case-content]");
  await expect(content).toHaveAttribute("data-mode", "scroll");
  await expect(tabs(page)).toHaveCount(2);
  const stage = await stacked(page);
  // Full width at 16:10.
  expect(Math.abs(stage.width / stage.height - 1.6)).toBeLessThan(0.05);
  await expect(panel(page).getByText(FIRST, { exact: true })).toBeInViewport();
  await expect(panel(page).getByRole("tablist")).toBeInViewport();
  // Nothing wider than the screen.
  const overflowX = await content.evaluate(
    (el) => el.scrollWidth > el.clientWidth + 1,
  );
  expect(overflowX).toBe(false);
});

test("small desktop tiers: the figures view never overlaps the footer while it stays wide", async ({
  page,
}) => {
  // Around the threshold where the stage minimum (240 px) + caption + strip no longer fit: either the panel
  // switches to the scrolling layout, or everything is stacked without overlap.
  const measured: string[] = [];
  for (const width of [1024, 1280]) {
    for (const height of [680, 700, 720, 740, 760, 780]) {
      await page.setViewportSize({ width, height });
      await page.goto("/en/projects?case=siteplus&fig=1");
      await expect(tabs(page)).toHaveCount(2);
      await page.evaluate(() => document.fonts.ready);
      const mode = await page
        .locator("[data-case-content]")
        .evaluate(
          (el) =>
            new Promise<string>((resolve) =>
              requestAnimationFrame(() =>
                resolve(el.getAttribute("data-mode") ?? ""),
              ),
            ),
        );
      measured.push(`${width}x${height}: ${mode}`);
      const stage = await stacked(page);
      if (mode === "wide") expect(stage.height).toBeGreaterThanOrEqual(240);
    }
  }
  console.log(`[figures tiers] ${measured.join(" | ")}`);
});

test("a taller footer (many tech chips) at 1024x680 pushes the figures view into scroll mode instead of overlapping", async ({
  page,
}) => {
  const measured: string[] = [];
  for (const extra of [0, 40, 80, 120, 160, 240]) {
    await page.setViewportSize({ width: 1024, height: 720 });
    await page.goto("/en/projects?case=siteplus&fig=1");
    await expect(tabs(page)).toHaveCount(2);
    await page.evaluate(() => document.fonts.ready);
    // Stands in for a project whose tech chips wrap onto more lines; the resize makes the panel measure again.
    await page.addStyleTag({
      content: `[data-case-panel] footer { padding-bottom: ${16 + extra}px !important; }`,
    });
    await page.setViewportSize({ width: 1024, height: 680 });
    const content = page.locator("[data-case-content]");
    const read = () =>
      content.evaluate((el) => ({
        mode: el.getAttribute("data-mode") ?? "",
        scroll: el.scrollHeight,
        client: el.clientHeight,
      }));
    // The re-measure runs in the ResizeObserver step of a frame: poll until it has settled. Wide must mean it fits.
    await expect
      .poll(async () => {
        const m = await read();
        return m.mode === "scroll" || m.scroll <= m.client + 1;
      })
      .toBe(true);
    const m = await read();
    measured.push(`+${extra}: ${m.mode} ${m.scroll}/${m.client}`);
    await stacked(page);
  }
  console.log(`[figures footer] ${measured.join(" | ")}`);
});

for (const theme of ["dark", "light"] as const) {
  test(`${theme}: the figures view passes axe`, async ({ page }) => {
    await page.addInitScript((theme) => {
      localStorage.setItem("theme", theme);
      sessionStorage.setItem("hello", "1");
    }, theme);
    await page.goto("/en/projects?case=siteplus&fig=2");
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await expect(tabs(page)).toHaveCount(2);
    const { violations } = await new AxeBuilder({ page })
      .include("[data-case-panel]")
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

test("reduced motion: switching views and figures animates no transform", async ({
  page,
}) => {
  // Records the keyframes of every animation inside the panel: Web Animations calls and CSS animations as they start.
  await page.addInitScript(() => {
    const seen: string[][] = [];
    (window as unknown as { __seen: string[][] }).__seen = seen;
    const inPanel = (el: Element) => !!el.closest("[data-case-panel]");
    const record = (animation: Animation) => {
      if (animation.effect instanceof KeyframeEffect)
        seen.push(
          animation.effect.getKeyframes().flatMap((k) => Object.keys(k)),
        );
    };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const animation = animate.call(this, keyframes, options);
      if (inPanel(this)) record(animation);
      return animation;
    };
    document.addEventListener("animationstart", (event) => {
      const target = event.target as Element;
      if (inPanel(target)) for (const a of target.getAnimations()) record(a);
    });
  });
  await page.goto("/en/projects?case=siteplus");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await panel(page).getByRole("button", { name: "Figures · 2" }).click();
  await expect(tabs(page)).toHaveCount(2);
  await page.keyboard.press("ArrowRight");
  await expect(tabs(page).nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await panel(page).getByRole("button", { name: "Content" }).click();
  await panel(page).getByRole("button", { name: "Figures · 2" }).click();
  await expect(tabs(page)).toHaveCount(2);
  const seen = await page.evaluate(
    () => (window as unknown as { __seen: string[][] }).__seen,
  );
  // Something did animate (the fades), and none of it moved anything.
  expect(seen.length).toBeGreaterThan(0);
  const moving = seen.filter((props) =>
    props.some(
      (p) => p === "transform" || p === "translate" || p === "clipPath",
    ),
  );
  expect(moving).toEqual([]);
});
