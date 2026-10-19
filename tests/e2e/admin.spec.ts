import { expect, test } from "@playwright/test";

test("the admin area sends visitors to the login page and stays out of search results", async ({ page }) => {
  await page.goto("/admin/projects");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fprojects$/);
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
