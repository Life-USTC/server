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
    ["list"],
    ["html", { open: "never", outputFolder: `${reportRoot}/html` }],
  ],
  snapshotPathTemplate:
    "{testDir}/visual-matrix/snapshots/{arg}{-projectName}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    trace: "retain-on-failure",
    screenshot: { mode: "only-on-failure", fullPage: true },
  },
  globalSetup: "./tests/e2e/global-setup.ts",
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
    {
      name: "visual-mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
      testMatch: ["visual-matrix/**/*.spec.ts"],
    },
    {
      name: "visual-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      },
      testMatch: ["visual-matrix/**/*.spec.ts"],
    },
  ],
});
