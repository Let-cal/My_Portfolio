import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Seed projects with a case study, in the archive's order (newest first). */
const CASE_IDS = [
  "skg-ai-agent",
  "skg-flexybox-p2",
  "skg-coa",
  "skg-flexybox-p1",
  "tongue-ai-driver-ms",
  "siteplus",
];

/** Waits until React has attached its handlers to the element (a click before that would be lost). */
async function hydrated(page: Page, selector: string) {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps$"));
  }, selector);
}

const dialog = (page: Page) => page.getByRole("dialog");

test("opens from the tree, and Esc returns focus to the opener", async ({
  page,
}) => {
  await page.goto("/en");
  await hydrated(page, "#tree-skg-coa button");
  const trigger = page
    .locator("#tree-skg-coa")
    .getByRole("button", { name: /case study: COA/ });
  await trigger.click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toHaveAccessibleName(/^COA/);
  await expect(page.locator("[data-case-panel]")).toContainText("第一章 経歴");
  await expect(page).toHaveURL(/\?case=skg-coa$/);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page).not.toHaveURL(/case=/);
});

test("opens from the bento", async ({ page }) => {
  await page.goto("/en");
  await hydrated(page, "#proj-siteplus");
  const trigger = page.locator("#proj-siteplus").getByRole("button");
  await trigger.click();
  await expect(dialog(page)).toHaveAccessibleName("SitePlus");
  await expect(page.locator("[data-case-panel]")).toContainText("第二章 作品");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("opens from the archive; ←/→ walk the filtered list", async ({ page }) => {
  await page.goto("/en/projects?kind=work");
  await hydrated(page, "#row-skg-coa button");
  const trigger = page.locator("#row-skg-coa").getByRole("button");
  await trigger.click();
  await expect(dialog(page)).toHaveAccessibleName(/^COA/);
  await page.keyboard.press("ArrowRight");
  await expect(dialog(page)).toHaveAccessibleName("FlexyBox Phase 1");
  await expect(page).toHaveURL(/kind=work&case=skg-flexybox-p1$/);
  // The work filter leaves SitePlus (university) out of the walk: after TONGUE-AI comes the first work project.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(dialog(page)).toHaveAccessibleName("AI Agent");
  await page
    .getByRole("button", { name: "Previous project: TONGUE-AI & Driver MS" })
    .click();
  await expect(dialog(page)).toHaveAccessibleName("TONGUE-AI & Driver MS");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("?case=skg-coa opens on load", async ({ page }) => {
  await page.goto("/en?case=skg-coa");
  await expect(dialog(page)).toHaveAccessibleName(/^COA/);
  // In the tree and the home page: the tree is its list.
  await expect(page.locator("[data-case-panel]")).toContainText("第一章 経歴");
});

test("an unknown ?case= id is dropped from the URL", async ({ page }) => {
  await page.goto("/en/projects?case=nope");
  await expect(page).toHaveURL(/\/en\/projects$/);
  await expect(dialog(page)).toHaveCount(0);
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
]) {
  for (const locale of ["en", "vi"]) {
    test(`fit: every case study fits without scrolling at ${viewport.width}x${viewport.height} (${locale})`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const measured: string[] = [];
      for (const id of CASE_IDS) {
        await page.goto(`/${locale}/projects?case=${id}`);
        const content = page.locator("[data-case-content]");
        await expect(content).toHaveAttribute("data-mode", /wide|scroll/);
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
        measured.push(`${id}: ${m.mode} ${m.scroll}/${m.client}`);
        expect.soft(m.mode, `${id} mode`).toBe("wide");
        expect.soft(m.scroll, `${id} height`).toBeLessThanOrEqual(m.client + 1);
      }
      console.log(
        `[fit ${viewport.width}x${viewport.height} ${locale}] ${measured.join(" | ")}`,
      );
    });
  }
}

test("a small viewport scrolls one column instead of clipping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/projects?case=skg-flexybox-p2");
  const content = page.locator("[data-case-content]");
  await expect(content).toHaveAttribute("data-mode", "scroll");
  const overflowY = await content.evaluate(
    (el) => getComputedStyle(el).overflowY,
  );
  expect(overflowY).toBe("auto");
});

for (const theme of ["dark", "light"] as const) {
  test(`${theme}: the open panel passes axe`, async ({ page }) => {
    await page.addInitScript((theme) => {
      localStorage.setItem("theme", theme);
      sessionStorage.setItem("hello", "1");
    }, theme);
    await page.goto("/en/projects?case=skg-flexybox-p2");
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await expect(dialog(page)).toBeVisible();
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
