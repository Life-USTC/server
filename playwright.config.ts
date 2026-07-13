import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "src/app/**/*.spec.ts",
    "src/app/**/*.test.ts",
    "src/app/**/test.ts",
  ],
  outputDir: "playwright-report/e2e-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Shared seeded users are mutated by several E2E files. Keep the suite
  // single-worker so those stateful cases run sequentially.
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["blob", { outputDir: "playwright-report/blob" }]]
    : [
        ["list"],
        ["html", { open: "never", outputFolder: "playwright-report/html" }],
      ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: { mode: "on", fullPage: true },
  },
  webServer: {
    command: "bun run e2e:server",
    url: baseURL,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 300_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      testMatch: ["mobile-screenshots/**/*.spec.ts"],
    },
  ],
});
