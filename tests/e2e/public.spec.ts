import { expect, test, type Page } from "@playwright/test";

const SECTION_IDS = ["hero", "experience", "projects", "skills", "certificates", "why", "contact"];
const NAME = "Le Tran Cat Lam";

/**
 * Waits until React has attached its handlers to the element. Server HTML already shows the default role,
 * so a click or a keypress sent before this point would be lost.
 */
async function hydrated(page: Page, selector: string) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps$"));
    },
    selector,
  );
}

test.describe("home page", () => {
  test("/en renders the seven sections", async ({ page }) => {
    await page.goto("/en");
    for (const id of SECTION_IDS) {
      await expect(page.locator(`main section#${id}`), `#${id}`).toHaveCount(1);
    }
    await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
  });

  for (const locale of ["ja", "vi"]) {
    test(`/${locale} renders the name heading and no "undefined"`, async ({ page }) => {
      const response = await page.goto(`/${locale}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
      expect(await page.locator("body").innerText()).not.toContain("undefined");
    });
  }

  test("/en?role=pm shows the project manager title", async ({ page }) => {
    await page.goto("/en?role=pm");
    // ?role= is applied right after hydration.
    await expect(page.getByRole("radio", { name: "TECHNICAL PM" })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#hero-title")).toContainText("Technical Project Manager");
  });

  test("choosing Tech Lead on the role wheel puts role=techlead in the URL", async ({ page }) => {
    await page.goto("/en");
    await hydrated(page, '[role="radio"][aria-label="TECH LEAD"]');
    const techLead = page.getByRole("radio", { name: "TECH LEAD" });
    await techLead.scrollIntoViewIfNeeded();
    // An arc's bounding box is centred on the portrait, so click the middle of the arc line itself.
    const point = await techLead.locator("path.hero-arc-line").evaluate((path: SVGPathElement) => {
      const p = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!);
      return { x: p.x, y: p.y };
    });
    await page.mouse.click(point.x, point.y);
    await expect(page).toHaveURL(/[?&]role=techlead/);
    await expect(techLead).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#hero-title")).toContainText("Tech Lead");
  });

  test("an unknown role falls back to Full-stack", async ({ page }) => {
    await page.goto("/en?role=xyz");
    await expect(page.getByRole("radio", { name: "DEVELOPER" })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#hero-title")).toContainText("Full-stack Software Engineer");
  });

  test("/fr is a 404", async ({ page }) => {
    const response = await page.goto("/fr");
    expect(response?.status()).toBe(404);
  });

  test("Ctrl+K opens the command palette", async ({ page }) => {
    await page.goto("/en");
    await hydrated(page, '[role="radio"][aria-label="TECH LEAD"]');
    // The palette shell registers its listener in an effect right after hydration; retry the key press once if it was early.
    await expect(async () => {
      await page.keyboard.press("Control+K");
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 15_000 });
    await expect(page.getByRole("dialog").getByRole("combobox")).toBeVisible();
  });
});

test.describe("quick view", () => {
  test("/en/quick has no canvas and a Print button", async ({ page }) => {
    const response = await page.goto("/en/quick");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("the title follows ?role= and the CV link follows the role", async ({ page }) => {
    await page.goto("/en/quick?role=pm");
    await expect(page.getByRole("article").locator("#quick-title")).toHaveText("Software Engineer · Technical Project Manager");
    await expect(page.getByRole("link", { name: "Download CV" })).toHaveAttribute("href", /TechnicalPM\.pdf$/);
    await page.goto("/en/quick?role=xyz");
    await expect(page.getByRole("article").locator("#quick-title")).toHaveText("Full-stack Software Engineer");
  });

  test("shows four experiences, four certificates, no phone number and a way back", async ({ page }) => {
    await page.goto("/en/quick?role=techlead");
    await expect(page.locator("[data-quick-experience]")).toHaveCount(4);
    await expect(page.locator("[data-quick-certificate]")).toHaveCount(4);
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("undefined");
    expect(text).not.toMatch(/\+?\d[\d\s().-]{8,}\d/);
    const back = page.getByRole("link", { name: "Back to full site" });
    await expect(back).toHaveAttribute("href", "/en?role=techlead");
  });

  test("going back from the 60-second view brings the site chrome back", async ({ page }) => {
    await page.goto("/en");
    await hydrated(page, '[role="radio"][aria-label="TECH LEAD"]');
    await expect(page.locator("body > header")).toBeVisible();
    await page.locator("#hero").getByRole("link", { name: "60-second view" }).click();
    await expect(page).toHaveURL(/\/en\/quick/);
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
    // On screen the quick view has its own toolbar and no site header or side rail.
    await expect(page.locator("body > header")).toBeHidden();
    await expect(page.locator("aside")).toBeHidden();
    await page.goBack();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("body > header")).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Choose a role" })).toBeVisible();
  });

  for (const locale of ["ja", "vi"]) {
    test(`/${locale}/quick renders without "undefined"`, async ({ page }) => {
      const response = await page.goto(`/${locale}/quick?role=pm`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
      expect(await page.locator("body").innerText()).not.toContain("undefined");
    });
  }

  test("print layout drops the site chrome and fits one A4 page", async ({ page }) => {
    await page.goto("/en/quick?role=pm");
    await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("body > header")).toBeHidden();
    await expect(page.locator("aside")).toBeHidden();
    await expect(page.locator("footer")).toBeHidden();
    await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
    const pdf = await page.pdf({ format: "A4" });
    const pages = pdf.toString("latin1").match(/\/Type\s*\/Page(?![a-z])/g) ?? [];
    expect(pages).toHaveLength(1);
  });
});
