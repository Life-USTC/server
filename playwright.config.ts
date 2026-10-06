import { defineConfig, devices } from "@playwright/test";

const reportRoot = process.env.E2E_REPORT_ROOT ?? "playwright-report";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "src/app/**/*.spec.ts",
    "src/app/**/*.test.ts",
    "src/app/**/test.ts",
    "src/testing/**/*.test.ts",
  ],
  outputDir: `${reportRoot}/e2e-results`,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  failOnFlakyTests: !!process.env.CI,
  // Preserve deterministic failures; each case owns its runtime lifecycle.
  retries: 0,
  // Bound local resource use independently of test-state isolation.
  workers: 1,
  reporter: [
    [process.env.CI ? "dot" : "list"],
    ["html", { open: "never", outputFolder: `${reportRoot}/html` }],
  ],
  use: {
    trace: "retain-on-failure",
    screenshot: { mode: "only-on-failure", fullPage: true },
  },
  globalSetup: "./tests/shared/runtime-database.ts",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      testMatch: ["mobile-pages/**/*.spec.ts"],
    },
  ],
});
