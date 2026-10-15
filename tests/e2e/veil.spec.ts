import { expect, test } from "@playwright/test";

// Each case starts a live WebGL scene; avoid competing for the same test GPU.
test.describe.configure({ mode: "serial" });

for (const theme of ["light", "dark"]) {
  test(`${theme}: Skills backgrounds follow their groups during wheel scrolling under the pointer`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript((theme) => {
      Object.defineProperty(navigator, "hardwareConcurrency", { value: 4 });
      localStorage.setItem("motion", "on"); localStorage.setItem("theme", theme); sessionStorage.setItem("hello", "1");
    }, theme);
    await page.goto("/vi");
    await expect(page.locator("[data-koi-veil]>i").first()).toBeAttached({ timeout: 20_000 });
    const groups = page.locator("[data-skill-group]");
    await expect(page.locator("[data-skill-surface]")).toHaveCount(await groups.count());
    await groups.first().evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 260));
    await page.mouse.move(615, 430);
    const sampling = page.evaluate(async () => {
      const groups = [...document.querySelectorAll<HTMLElement>("[data-skill-group]")];
      let maximumDrift = 0, translucent = 0;
      for (let frame = 0; frame < 100; frame++) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        for (const group of groups) {
          const card = group.querySelector<HTMLElement>(":scope > [data-skill-surface]")!;
          const g = group.getBoundingClientRect(), b = card.getBoundingClientRect();
          maximumDrift = Math.max(maximumDrift, Math.abs(b.top - g.top + 12), Math.abs(b.left - g.left + 16));
          const color = getComputedStyle(card).backgroundColor;
          if (color === "transparent" || /rgba\([^)]*,\s*0(?:\.\d+)?\s*\)/.test(color)) translucent++;
        }
      }
      return { maximumDrift, translucent };
    });
    for (let step = 0; step < 4; step++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(55); }
    for (let step = 0; step < 4; step++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(55); }
    const result = await sampling;
    expect(result.maximumDrift).toBeLessThan(0.1);
    expect(result.translucent).toBe(0);
    await expect(groups.first().locator("[data-skill-chip]").first()).toBeEnabled();
  });
}

test("chapter seals stay above the padded primary headings", async ({ page }) => {
  await page.goto("/vi");
  for (const id of ["experience", "projects", "skills", "certificates", "why", "contact"]) {
    const gap = await page.locator(`#${id}`).evaluate((section) => {
      const heading = section.querySelector("h2")!.getBoundingClientRect();
      const seal = section.parentElement!.querySelector("[data-chapter-seal]")!.getBoundingClientRect();
      return heading.top - seal.bottom;
    });
    expect(gap, id).toBeGreaterThanOrEqual(24);
  }
});

test("scrolling Skills does not reassign existing backdrop nodes across the screen", async ({ page }) => {
  const textures: number[] = [];
  const shaderErrors: string[] = [];
  page.on("response", (response) => { if (response.url().endsWith("/scene/waterfall/rocks/rocks.gltf")) textures.push(response.status()); });
  page.on("console", (message) => { if (message.type() === "error" && /WebGLProgram|VALIDATE_STATUS|shader error/i.test(message.text())) shaderErrors.push(message.text()); });
  await page.setViewportSize({ width: 1280, height: 768 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 4 });
    localStorage.setItem("motion", "on"); sessionStorage.setItem("hello", "1");
  });
  await page.goto("/vi");
  await expect(page.locator("[data-koi-veil]>i").first()).toBeAttached({ timeout: 20_000 });
  expect(textures).toEqual([]);
  await page.locator("#skills").evaluate((el) => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top));
  await page.waitForTimeout(1000);
  await expect.poll(() => textures).toEqual([200]);
  const teleports = await page.evaluate(async () => {
    const previous = new Map<Element, { x: number; y: number }>();
    let jumps = 0;
    for (let i = 0; i < 55; i++) {
      window.scrollBy(0, 12);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      for (const el of document.querySelectorAll<HTMLElement>("[data-koi-veil]>i")) {
        if (el.style.display === "none") { previous.delete(el); continue; }
        const box = el.getBoundingClientRect(), old = previous.get(el);
        if (old && Math.abs(box.x - old.x) + Math.abs(box.y - old.y + 12) > 160) jumps++;
        previous.set(el, { x: box.x, y: box.y });
      }
    }
    return jumps;
  });
  expect(teleports).toBe(0);
  expect(shaderErrors).toEqual([]);
});

for (const theme of ["light", "dark"]) {
  test(`${theme}: moving Why cards and hero marquee never stretch the text backdrop across the sidebar`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 768 });
    await page.addInitScript((theme) => {
      Object.defineProperty(navigator, "hardwareConcurrency", { value: 4 });
      localStorage.setItem("theme", theme);
      localStorage.setItem("motion", "on");
      sessionStorage.setItem("hello", "1");
    }, theme);
    await page.goto("/vi?role=pm");
    await expect(page.locator("[data-koi-veil]>i").first()).toBeAttached({ timeout: 20_000 });
    await page.locator("#why").evaluate((el) => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top + 160));
    const noOversizedPanels = async () => page.evaluate(() => {
      const main = document.querySelector("main")!.getBoundingClientRect();
      return [...document.querySelectorAll("[data-koi-veil]>i")].every((panel) => {
        if (getComputedStyle(panel).display === "none") return true;
        const box = panel.getBoundingClientRect();
        // 24px soft padding is allowed; no rectangle may bridge both columns.
        return !(box.left < main.left - 24 && box.right > main.left + 24);
      });
    });
    for (let step = 0; step < 3; step++) {
      await expect.poll(noOversizedPanels).toBe(true);
      await expect(page.locator("#why [data-why-card][data-scene-veil=off]")).toHaveCount(4);
      if (step < 2) {
        await page.locator('#why [aria-roledescription="carousel"]').press("ArrowRight");
        await page.waitForTimeout(850);
      }
    }
    await page.locator(".hero-stroke-text").first().evaluate((el) => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 400));
    await expect.poll(noOversizedPanels).toBe(true);
    expect(await page.locator(".hero-stroke-text").first().evaluate((el) => !!el.closest("[data-scene-ignore]"))).toBe(true);
  });
}
