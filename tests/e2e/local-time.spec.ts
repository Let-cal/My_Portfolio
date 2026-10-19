import { expect, test } from "@playwright/test";

test("offscreen clocks activate on approach without changing their reserved width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 823 });
  await page.goto("/en");
  // Establish hydration through a real control; the SSR placeholder alone is not proof of deferral.
  await expect(async () => {
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  const clock = page
    .locator('span.tabular-nums[style*="min-width:13ch"]')
    .first();
  await expect(clock).toHaveText("--:-- (GMT+7)");
  const width = await clock.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  await clock.scrollIntoViewIfNeeded();
  await expect(clock).toHaveText(/^\d{2}:\d{2} \(GMT\+7\)$/);
  expect(
    await clock.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeCloseTo(width, 1);
});
