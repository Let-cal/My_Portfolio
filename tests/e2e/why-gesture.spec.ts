import { expect, test } from "@playwright/test";

test.use({ hasTouch: true });

for (const input of ["mouse", "touch"]) {
test(`the first ${input} carousel drag works even before its approach observer reports`, async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.addInitScript(() => {
    localStorage.setItem("motion", "on");
    sessionStorage.setItem("hello", "1");
    const NativeIO = window.IntersectionObserver;
    window.IntersectionObserver = class extends NativeIO {
      observe(target: Element) {
        if (this.rootMargin === "600px 600px 600px 600px" && target.querySelector("[data-carousel-track]")) return;
        super.observe(target);
      }
    };
  });
  // Exercise real Motion drag while isolating it from GPU rendering cost in this regression.
  await page.addInitScript(`{
    window.whyStartupMeasures = 0;
    const getRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() {
      if (this.hasAttribute('data-carousel-track')) window.whyStartupMeasures++;
      return getRect.call(this);
    };
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === 'webgl' || type === 'webgl2') return null;
      return getContext.call(this, type, ...args);
    };
  }`);
  await page.goto("/en");
  await expect.poll(() => page.evaluate(() => (window as Window & { MotionIsMounted?: boolean }).MotionIsMounted)).toBe(true);
  expect(await page.evaluate(() => (window as Window & { whyStartupMeasures?: number }).whyStartupMeasures)).toBe(0);
  await page.locator("#why").evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 60));
  const track = page.locator("[data-carousel-track]");
  const box = await track.boundingBox();
  expect(box).not.toBeNull();
  const x = Math.min(800, box!.x + 600), y = box!.y + 150;
  if (input === "mouse") {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 330, y, { steps: 16 });
    await page.mouse.up();
  } else {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 16; step++) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 330 * step / 16, y }] });
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
  }
  await expect.poll(() => track.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)).toBeLessThan(-30);
  await expect(page.locator("#why [role='status']")).not.toHaveText("1 of 4");
});
}
