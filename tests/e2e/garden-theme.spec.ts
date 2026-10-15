import { expect, test } from "@playwright/test";

test("the obsidian garden shares its fog and water palette and restores daylight and adjacent cyber scenes", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 4 });
    localStorage.setItem("motion", "on"); localStorage.setItem("theme", "dark"); sessionStorage.setItem("hello", "1");
    const probe = { cameraZ: 0, environment: 0, fog: [0, 0, 0], water: "", sky: "" };
    Object.assign(window, { gardenProbe: probe });
    const proto = WebGL2RenderingContext.prototype;
    const names = new WeakMap<WebGLUniformLocation, string>();
    const getLocation = proto.getUniformLocation;
    proto.getUniformLocation = function (program, name) {
      const location = getLocation.call(this, program, name);
      if (location) names.set(location, name);
      return location;
    };
    const uniform3f = proto.uniform3f;
    proto.uniform3f = function (location, x, y, z) {
      const name = location && names.get(location);
      if (name === "cameraPosition") probe.cameraZ = z;
      if (name === "fogColor") probe.fog = [x, y, z];
      uniform3f.call(this, location, x, y, z);
    };
    const uniform1f = proto.uniform1f;
    proto.uniform1f = function (location, value) {
      if (location && names.get(location) === "envMapIntensity") probe.environment = value;
      uniform1f.call(this, location, value);
    };
    const shaderSource = proto.shaderSource;
    proto.shaderSource = function (shader, source) {
      if (source.includes("underwaterGrid")) probe.water = source;
      if (source.includes("vec3 dawn =")) probe.sky = source;
      shaderSource.call(this, shader, source);
    };
  });
  const probe = () => page.evaluate(() => (window as unknown as { gardenProbe: {
    cameraZ: number; environment: number; fog: number[]; water: string; sky: string;
  } }).gardenProbe);
  await page.goto("/vi");
  await expect(page.locator("[data-koi-veil]>i").first()).toBeAttached({ timeout: 25_000 });
  const scrollTo = (id: string) => page.locator(`#${id}`).evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 100));
  await scrollTo("skills");
  await expect.poll(async () => (await probe()).cameraZ, { timeout: 25_000 }).toBeGreaterThan(11.99);
  await expect.poll(async () => (await probe()).environment).toBeCloseTo(0.65, 2);
  const night = await probe();
  // sRGB #0b1318 decoded to linear, shared by water, sky and Stage fog.
  const horizon = "vec3(0.0033465, 0.0065121, 0.0091341)";
  expect(night.water).toContain(horizon);
  expect(night.sky).toContain(horizon);
  // On the low tier (direct canvas), Three uploads unlit fog in output sRGB.
  // Custom shader constants above stay linear; the Stage fog arrives encoded.
  expect(night.fog[2]).toBeCloseTo(24 / 255, 4);
  expect(night.water).toContain("mix(0.25, 1.0, uDay)");
  expect(night.water).toContain("underwaterGrid");

  await page.getByRole("button", { name: /theme|giao diện|chủ đề|テーマ/i }).click();
  await expect.poll(async () => (await probe()).environment).toBeCloseTo(1.25, 2);
  await expect.poll(async () => (await probe()).fog[2]).toBeCloseTo(0.78, 2);
  await page.getByRole("button", { name: /theme|giao diện|chủ đề|テーマ/i }).click();
  await expect.poll(async () => (await probe()).environment).toBeCloseTo(0.65, 2);

  // Move out in both directions: neither adjacent chapter inherits the garden's lighting.
  await scrollTo("certificates");
  await expect.poll(async () => (await probe()).environment, { timeout: 20_000 }).toBeCloseTo(1, 2);
  await scrollTo("experience");
  await expect.poll(async () => (await probe()).cameraZ, { timeout: 20_000 }).toBeLessThan(7);
  await expect.poll(async () => (await probe()).environment).toBeCloseTo(1, 2);
  expect(errors).toEqual([]);
});
