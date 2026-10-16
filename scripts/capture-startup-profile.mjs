import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

// Diagnostic only: never use this profiled run to evaluate release budgets.
const origin = process.env.PERF_ORIGIN ?? "http://localhost:3100";
mkdirSync(".lighthouseci", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.platform === "win32" ? "chrome" : undefined, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true, reducedMotion: "no-preference" });
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
  console.log(`Diagnostic CPU profile: ${profile.nodes.length} nodes, ${profile.samples?.length ?? 0} samples`);
} finally {
  await browser.close();
}
