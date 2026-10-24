import { defineConfig, devices } from "@playwright/test";
import { readTask4Settings, localOnlyProxy } from "./tests/e2e-admin/settings";

if (process.platform !== "linux")
  throw new Error("Task4 admin browsers require the owned Linux runner");

const { appOrigin } = readTask4Settings();

// Playwright 1.64 otherwise captures the signed-in DOM in error-context.md,
// even with screenshots and traces off. Failures are also sanitized in fixtures.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

export default defineConfig({
  testDir: "./tests/e2e-admin",
  testMatch: "admin-flows.spec.ts",
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  retries: 0,
  failOnFlakyTests: true,
  timeout: 90_000,
  globalTimeout: 12 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list", { printSteps: false }]],
  outputDir: "./test-results/task4-admin",
  preserveOutput: "never",
  use: {
    // Use the runner's preinstalled Chrome. A missing channel fails launch;
    // there is no bundled-browser fallback or installation in this config.
    // This version follows the ubuntu-24.04 runner image rather than Playwright's
    // bundled Chromium revision. The launcher records the exact installed version.
    channel: "chrome",
    baseURL: appOrigin,
    reducedMotion: "reduce",
    screenshot: "off",
    video: "off",
    trace: "off",
    storageState: undefined,
    serviceWorkers: "block",
    proxy: localOnlyProxy,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "task4-local-chrome", use: devices["Desktop Chrome"] }],
  // The primary launcher owns the build and services. Never start/reuse a server here.
});
