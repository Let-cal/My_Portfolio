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

test("motion on (smooth scroll): a skill evidence link to a collapsed child expands its parent", async ({
  page,
}) => {
  // Lenis handles in-page links with pushState, which fires no hashchange: the tree must still open the parent.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => localStorage.setItem("motion", "on"));
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
  await expect(page.locator("html")).toHaveClass(/\blenis\b/);
  await page
    .locator('[data-skill-chip][data-skill-name="Flutter"]')
    .first()
    .click();
  await page.locator('#skills-evidence a[href="#tree-zodiacgems"]').click();
  await expect(toggle(page, "exp-fpt-university")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator("#tree-zodiacgems")).toBeVisible();
  await expect.poll(() => inViewport(page, "tree-zodiacgems")).toBe(true);
});

test("stints are visible under SKG with their projects", async ({ page }) => {
  await page.goto("/en");
  const stints = page.locator("#exp-skg-software section[aria-labelledby]");
  await expect(stints).toHaveCount(2);
  await expect(stints.nth(0).getByRole("heading", { level: 4 })).toContainText(
    "Software Engineer — acting Project Manager / Tech Lead",
  );
  await expect(stints.nth(0).locator("#tree-skg-coa")).toBeVisible();
  await expect(stints.nth(1).getByRole("heading", { level: 4 })).toContainText(
    "Software Engineer Intern",
  );
  await expect(stints.nth(1).locator("#tree-skg-flexybox-p1")).toBeVisible();
  await expect(
    page
      .locator("#exp-skg-software")
      .getByText("Promoted to full-time · Oct 2025"),
  ).toBeVisible();
});

test("a row description opens and closes by keyboard and stays in the DOM", async ({
  page,
}) => {
  await page.goto("/en");
  // Its name flips between Show and Hide description, so find it by the region it controls.
  const button = page.locator(
    '#tree-skg-coa button[aria-controls="desc-skg-coa"]',
  );
  const region = page.locator("#desc-skg-coa");
  await expect(button).toHaveText("Show description");
  await expect(region).toBeHidden();
  await expect(region).toHaveText(/./);
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(button).toHaveText("Hide description");
  await expect(button).toBeFocused();
  await expect(region).toBeVisible();
  await page.keyboard.press("Space");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(region).toBeHidden();
});

test("hash #tree-skg-coa opens SKG and scrolls to the row", async ({
  page,
}) => {
  await page.goto("/en#tree-skg-coa");
  await expect(toggle(page, "exp-skg-software")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator("#tree-skg-coa")).toBeVisible();
  await expect.poll(() => inViewport(page, "tree-skg-coa")).toBe(true);
});

test("hash #exp-fpt-university expands that parent and scrolls to it", async ({
  page,
}) => {
  await page.goto("/en#exp-fpt-university");
  await expect(toggle(page, "exp-fpt-university")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator("#tree-siteplus")).toBeVisible();
  await expect.poll(() => inViewport(page, "exp-fpt-university")).toBe(true);
});

test("Gantt: hovering a row lights its bar, hovering a bar lights its row, clicking a bar scrolls to it", async ({
  page,
}) => {
  await page.goto("/en");
  const gantt = page.locator("#exp-skg-software [role=img]");
  await expect(gantt).toBeVisible();
  await expect(gantt).toHaveAttribute("aria-label", /SKG Software/);
  await expect(gantt.locator("[data-bar]")).toHaveCount(5);
  const bar = (id: string) => gantt.locator(`[data-bar][data-sync="${id}"]`);
  await page.locator("#tree-skg-coa h5").hover();
  await expect(bar("skg-coa")).toHaveAttribute("data-lit", "");
  await expect(bar("skg-ai-agent")).not.toHaveAttribute("data-lit");
  await bar("tongue-ai-driver-ms").hover();
  await expect(page.locator("#tree-tongue-ai-driver-ms")).toHaveAttribute(
    "data-lit",
    "",
  );
  await expect(bar("skg-coa")).not.toHaveAttribute("data-lit");
  await bar("tongue-ai-driver-ms").click();
  await expect
    .poll(() => inViewport(page, "tree-tongue-ai-driver-ms"))
    .toBe(true);
  // Keyboard focus in a row lights its bar too.
  await page
    .locator("#tree-skg-flexybox-p2")
    .getByRole("button", { name: "Show description" })
    .focus();
  await expect(bar("skg-flexybox-p2")).toHaveAttribute("data-lit", "");
});

test("phone width: the Gantt hides its bar labels and nothing scrolls sideways", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/en");
  const gantt = page.locator("#exp-skg-software [role=img]");
  await expect(gantt).toBeVisible();
  await expect(gantt.locator(".jt-blabel").first()).toBeHidden();
  await expect(gantt.locator("[data-bar]").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

for (const { locale, width } of [
  { locale: "ja", width: 375 },
  { locale: "vi", width: 375 },
  { locale: "en", width: 375 },
  { locale: "ja", width: 1366 },
  { locale: "vi", width: 1366 },
]) {
  test(`${locale} at ${width} px: no Gantt label is cut (it fits or is hidden)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/${locale}`);
    const gantt = page.locator("#exp-skg-software [role=img]");
    await expect(gantt).toBeVisible();
    await expect(gantt.locator(".jt-seg")).toHaveCount(2);
    const cut = await gantt.evaluate((root) => {
      const bad: string[] = [];
      for (const seg of root.querySelectorAll<HTMLElement>(".jt-seg")) {
        const painted = getComputedStyle(seg).color !== "rgba(0, 0, 0, 0)";
        if (painted && seg.scrollWidth > seg.clientWidth)
          bad.push(`segment "${seg.textContent}"`);
      }
      for (const label of root.querySelectorAll<HTMLElement>(".jt-blabel")) {
        const style = getComputedStyle(label);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const lane = label.parentElement!;
        if (
          label.offsetLeft < 0 ||
          label.offsetLeft + label.offsetWidth > lane.clientWidth
        )
          bad.push(`bar label "${label.textContent}"`);
      }
      return bad;
    });
    expect(cut).toEqual([]);
  });
}

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
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  const panel = page.locator("#exp-fpt-university [data-journey-panel]");
  await expect(panel).toHaveCSS("transition-duration", "0s");
  // The ink rail is fully drawn and static; the hanko and the Gantt do not move.
  await expect(page.locator("[data-ink-rail]")).toHaveAttribute(
    "data-progress",
    "1",
  );
  await expect(page.locator(".jt-rail-fill")).toHaveCSS(
    "stroke-dashoffset",
    "0px",
  );
  await expect(page.locator("#exp-skg-software [data-hanko]")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator("#exp-skg-software [data-bar]").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  await toggle(page, "exp-fpt-university").click();
  await expect(page.locator("#tree-siteplus")).toHaveCSS(
    "animation-name",
    "none",
  );
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
  await toggle(page, "exp-fpt-university").click();
  // Rows rise in with a stagger capped at 6 (40 ms each); the hanko has stamped.
  await expect(page.locator("#tree-siteplus")).toHaveCSS(
    "animation-name",
    "jt-rise",
  );
  await expect(page.locator("#exp-fpt-university [data-hanko]")).toHaveCSS(
    "animation-name",
    "jt-stamp",
  );
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
    await expect(page.locator("#exp-skg-software [role=img]")).toBeVisible();
    await page
      .locator("#tree-skg-coa")
      .getByRole("button", { name: "Show description" })
      .click();
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
