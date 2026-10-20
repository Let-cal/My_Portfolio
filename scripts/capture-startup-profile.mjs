import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { basename } from "node:path";

// Diagnostic only: never use this profiled run to evaluate release budgets.
const origin = process.env.PERF_ORIGIN ?? "http://localhost:3100";
mkdirSync(".lighthouseci", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.platform === "win32" ? "chrome" : undefined,
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 412, height: 823 },
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await client.send("Profiler.enable");
  await client.send("Profiler.setSamplingInterval", { interval: 1000 });
  await client.send("Profiler.start");
  await page.goto(`${origin}/en`, { waitUntil: "load", timeout: 30_000 });
  await page.waitForTimeout(2000);
  const { profile } = await client.send("Profiler.stop");
  writeFileSync(".lighthouseci/en-startup.cpuprofile", JSON.stringify(profile));
  // Keep the exact public chunks with the samples: Linux/Windows build hashes can differ.
  // Fetch only this deployment's public scripts, after profiling and scored measurements finish.
  mkdirSync(".lighthouseci/startup-scripts", { recursive: true });
  const scripts = [
    ...new Set(profile.nodes.map((node) => node.callFrame.url)),
  ].filter((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return (
      url.origin === new URL(origin).origin &&
      /^\/_next\/static\/chunks\/.*\.js$/.test(url.pathname)
    );
  });
  await Promise.all(
    scripts.map(async (value) => {
      const response = await fetch(value, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok)
        throw new Error(`Diagnostic script fetch failed: ${response.status}`);
      writeFileSync(
        `.lighthouseci/startup-scripts/${basename(new URL(value).pathname)}`,
        await response.text(),
      );
    }),
  );
  console.log(
    `Diagnostic CPU profile: ${profile.nodes.length} nodes, ${profile.samples?.length ?? 0} samples`,
  );
} finally {
  await browser.close();
}
