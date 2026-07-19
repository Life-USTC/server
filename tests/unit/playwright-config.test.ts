import { afterEach, describe, expect, test, vi } from "vitest";

async function loadConfig(ci: string) {
  vi.resetModules();
  vi.stubEnv("CI", ci);
  return (await import("../../playwright.config")).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Playwright configuration", () => {
  test("rejects focused tests and starts its own server in CI", async () => {
    const config = await loadConfig("1");

    expect(config).toMatchObject({
      forbidOnly: true,
      use: { baseURL: "http://localhost:3000" },
      webServer: {
        reuseExistingServer: false,
        url: "http://localhost:3000",
      },
    });
  });

  test("starts its own server locally too", async () => {
    const config = await loadConfig("");

    expect(config).toMatchObject({
      forbidOnly: false,
      webServer: { reuseExistingServer: false },
    });
  });
});
