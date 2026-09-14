import { afterEach, describe, expect, test, vi } from "vitest";

const workerDatabaseEnvironment = {
  FUNCTION_OWNER_DATABASE_URL:
    "postgresql://fixture-owner:fixture-owner@127.0.0.1:55532/life_ustc_fixture",
  DATABASE_URL:
    "postgresql://life-ustc-runtime:runtime@127.0.0.1:55532/life_ustc_runtime",
  AUTH_DATABASE_URL:
    "postgresql://life-ustc-auth-runtime:auth@127.0.0.1:55532/life_ustc_auth_runtime",
  MAINTENANCE_DATABASE_URL:
    "postgresql://life-ustc-maintenance-runtime:maintenance@127.0.0.1:55532/life_ustc_maintenance_runtime",
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:
    "postgresql://life-ustc-runtime:runtime@127.0.0.1:55532/life_ustc_runtime",
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH:
    "postgresql://life-ustc-auth-runtime:auth@127.0.0.1:55532/life_ustc_auth_runtime",
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE:
    "postgresql://life-ustc-maintenance-runtime:maintenance@127.0.0.1:55532/life_ustc_maintenance_runtime",
} as const;

async function loadConfig(ci: string) {
  vi.resetModules();
  vi.stubEnv("CI", ci);
  for (const [name, value] of Object.entries(workerDatabaseEnvironment)) {
    vi.stubEnv(name, value);
  }
  return (await import("../../../playwright.config")).default;
}

async function loadApiConfig(ci: string) {
  vi.resetModules();
  vi.stubEnv("CI", ci);
  for (const [name, value] of Object.entries(workerDatabaseEnvironment)) {
    vi.stubEnv(name, value);
  }
  return (await import("../../../playwright.api.config")).default;
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
      retries: 0,
      use: {
        baseURL: "http://localhost:3000",
        trace: "retain-on-failure",
      },
      webServer: {
        gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
        reuseExistingServer: false,
        url: "http://localhost:3000",
      },
    });
    const webServer = config.webServer;
    if (!webServer || Array.isArray(webServer)) {
      throw new Error("Expected a single Playwright webServer configuration");
    }
    expect(webServer.command).toContain("env -u FUNCTION_OWNER_DATABASE_URL");
    expect(webServer.env).toMatchObject({
      DATABASE_URL: workerDatabaseEnvironment.DATABASE_URL,
      AUTH_DATABASE_URL: workerDatabaseEnvironment.AUTH_DATABASE_URL,
      MAINTENANCE_DATABASE_URL:
        workerDatabaseEnvironment.MAINTENANCE_DATABASE_URL,
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:
        workerDatabaseEnvironment.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE,
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH:
        workerDatabaseEnvironment.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH,
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE:
        workerDatabaseEnvironment.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE,
    });
    expect(webServer.env).not.toHaveProperty("FUNCTION_OWNER_DATABASE_URL");
  });

  test("starts its own server locally too", async () => {
    const config = await loadConfig("");

    expect(config).toMatchObject({
      forbidOnly: false,
      webServer: { reuseExistingServer: false },
    });
  });

  test("REST tests never reuse an existing Worker locally or in CI", async () => {
    const config = await loadApiConfig("");
    const webServer = config.webServer;
    if (!webServer || Array.isArray(webServer)) {
      throw new Error("Expected a single Playwright webServer configuration");
    }

    expect(webServer.reuseExistingServer).toBe(false);
    expect(webServer.command).toContain("env -u FUNCTION_OWNER_DATABASE_URL");
  });
});
