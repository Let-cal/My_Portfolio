import { expect, test } from "@playwright/test";
import sharp from "sharp";

for (const [locale, title] of [
  ["en", "Le Tran Cat Lam · Software Engineer Portfolio"],
  ["ja", "レ・チャン・カット・ラム · ソフトウェアエンジニア ポートフォリオ"],
  ["vi", "Lê Trần Cát Lâm · Portfolio Kỹ sư Phần mềm"],
] as const) {
  test(`${locale} exposes its canonical title, language links and person identity`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://letcal.is-a.dev/${locale}`);
    await expect(page.locator('link[rel="alternate"][hreflang="ja"]')).toHaveAttribute("href", "https://letcal.is-a.dev/ja");
    const person = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(person!)).toMatchObject({ "@type": "Person", name: "Le Tran Cat Lam", knowsLanguage: ["vi", "en", "ja"] });
    expect(JSON.parse(person!)).not.toHaveProperty("telephone");
  });
}

test("the printable view is noindex and points to the main locale page", async ({ page }) => {
  await page.goto("/ja/quick?role=pm");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://letcal.is-a.dev/ja");
});

test("robots, sitemap and manifest expose the public portfolio identity", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("Disallow: /admin");
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).not.toContain("/quick");
  expect(await sitemap.text()).toContain("https://letcal.is-a.dev/vi");
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect(await manifest.json()).toMatchObject({ short_name: "LETCAL", start_url: "/en" });
  const icon = await request.get("/icon.svg");
  expect(icon.ok()).toBe(true);
  expect(await icon.text()).toContain("#fb923c");
});

test("the share card is a real 1200 by 630 image", async ({ page, request }) => {
  await page.goto("/en");
  const content = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(content).toBeTruthy();
  const url = new URL(content!);
  const response = await request.get(`${url.pathname}${url.search}`);
  expect(response.ok()).toBe(true);
  const metadata = await sharp(await response.body()).metadata();
  expect(metadata).toMatchObject({ width: 1200, height: 630, format: "png" });
});
