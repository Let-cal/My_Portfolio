import { expect, test } from "@playwright/test";

test("the media library requires an admin session and preserves the return path", async ({
  page,
}) => {
  await page.goto("/admin/media");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fmedia$/);
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
});

test("the admin area sends visitors to the login page and stays out of search results", async ({
  page,
}) => {
  await page.goto("/admin/projects");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fprojects$/);
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
});

test("an admin link with a filter survives the trip through the login page", async ({
  page,
}) => {
  await page.goto("/admin/skills?filter=orphan");
  await expect(page).toHaveURL(
    /\/admin\/login\?next=%2Fadmin%2Fskills%3Ffilter%3Dorphan$/,
  );
});

test("preview entry remains protected and cannot mint a draft cookie for an anonymous visitor", async ({
  request,
}) => {
  const response = await request.get("/admin/preview?locale=ja&target=skills", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/admin/login?next=");
  expect(response.headers()["set-cookie"] ?? "").not.toContain(
    "__prerender_bypass",
  );
});

test("preview exit rejects cross-origin requests and redirects a local POST safely", async ({
  request,
  baseURL,
}) => {
  const rejected = await request.post("/api/preview/exit", {
    headers: { origin: "https://unrelated.example" },
  });
  expect(rejected.status()).toBe(403);
  const accepted = await request.post(
    "/api/preview/exit?locale=ja&target=skills",
    { headers: { origin: baseURL! }, maxRedirects: 0 },
  );
  expect(accepted.status()).toBe(303);
  expect(accepted.headers().location).toBe("/ja#skills");
  expect(accepted.headers()["cache-control"]).toContain("no-store");
});
