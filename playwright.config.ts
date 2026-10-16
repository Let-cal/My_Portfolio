import { defineConfig, devices } from "@playwright/test";

// 3100 keeps the suite clear of a dev server on 3000. The server is the production build, as in the deployed site.
const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // SwiftShader shares the runner CPU with the scene; concurrent browsers starve frame-driven checks.
  workers: process.env.CI ? 1 : undefined,
  timeout: process.env.CI ? 120_000 : 30_000,
  expect: { timeout: process.env.CI ? 30_000 : 5_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    launchOptions: { args: process.platform === "win32" ? ["--use-angle=d3d11"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    // Motion off: the hello greeting never covers the page, and nothing is mid-animation when a test clicks.
    reducedMotion: "reduce",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
