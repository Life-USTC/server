import { afterEach, describe, expect, test, vi } from "vitest";

async function loadConfigs(ci: string) {
  vi.resetModules();
  vi.stubEnv("CI", ci);
  vi.stubEnv("E2E_REPORT_ROOT", "test-reports");
  return Promise.all([
    import("../../../playwright.config").then((module) => module.default),
    import("../../../playwright.api.config").then((module) => module.default),
  ]);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Playwright configuration", () => {
  for (const ci of ["", "1"]) {
    test(`keeps runtime ownership in native fixtures with CI=${ci || "unset"}`, async () => {
      for (const config of await loadConfigs(ci)) {
        expect(config).toMatchObject({
          forbidOnly: Boolean(ci),
          retries: 0,
          workers: 1,
          globalSetup: "./tests/shared/runtime-database.ts",
          use: { trace: "retain-on-failure" },
        });
        expect(config.webServer).toBeUndefined();
        expect(config.use?.baseURL).toBeUndefined();
      }
    });
  }

  test("retains every browser project and separate native result directories", async () => {
    const [browser, api] = await loadConfigs("1");
    expect(browser.projects?.map((project) => project.name)).toEqual([
      "chromium",
      "mobile-chrome",
      "visual-mobile",
      "visual-desktop",
    ]);
    expect(browser.outputDir).toBe("test-reports/e2e-results");
    expect(api.outputDir).toBe("test-reports/api-results");
    expect(api.testDir).toBe("./tests/integration/rest");
  });
});
