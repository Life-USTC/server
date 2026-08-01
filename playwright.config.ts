import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3000";

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
