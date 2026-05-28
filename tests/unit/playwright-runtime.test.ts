import { DEV_SEED } from "@tools/dev/seed/dev-seed";
import {
  buildPlaywrightServerEnv,
  resolvePlaywrightHarnessRuntime,
} from "@tools/dev/util/playwright-runtime";
import { describe, expect, it } from "vitest";

describe("playwright runtime", () => {
  it("uses a fixed default worker count and ignores invalid overrides", () => {
    expect(resolvePlaywrightHarnessRuntime({}).workers).toBe(4);
    expect(resolvePlaywrightHarnessRuntime({ CI: "1" }).workers).toBe(4);
    expect(
      resolvePlaywrightHarnessRuntime({ PLAYWRIGHT_WORKERS: "invalid" })
        .workers,
    ).toBe(4);
    expect(
      resolvePlaywrightHarnessRuntime({ PLAYWRIGHT_WORKERS: "2x" }).workers,
    ).toBe(4);
    expect(
      resolvePlaywrightHarnessRuntime({ PLAYWRIGHT_WORKERS: "2" }).workers,
    ).toBe(2);
  });

  it("uses defaults for invalid retry and timeout overrides", () => {
    expect(
      resolvePlaywrightHarnessRuntime({ PLAYWRIGHT_RETRIES: "invalid" })
        .retries,
    ).toBe(0);
    expect(
      resolvePlaywrightHarnessRuntime({
        PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS: "3000ms",
      }).webServerTimeoutMs,
    ).toBe(300_000);
  });

  it("uses exact valid Playwright port overrides", () => {
    expect(
      resolvePlaywrightHarnessRuntime({ PLAYWRIGHT_PORT: "3100" }).port,
    ).toBe("3100");
    expect(
      resolvePlaywrightHarnessRuntime({ PLAYWRIGHT_PORT: "3100x" }).port,
    ).toBe("3000");
  });

  it("resolves CI and transparency mode once into Playwright settings", () => {
    expect(
      resolvePlaywrightHarnessRuntime({
        CI: "1",
        E2E_TRANSPARENCY: "1",
      }),
    ).toMatchObject({
      forbidOnly: true,
      reporter: [["github"]],
      retries: 2,
      reuseExistingServer: false,
      screenshot: "on",
      trace: "on",
    });
  });

  it("builds default debug auth env from dev seed data", () => {
    const env = buildPlaywrightServerEnv({
      host: "127.0.0.1",
      port: "3100",
      env: {},
    });

    expect(env).toMatchObject({
      E2E_DEBUG_AUTH: "1",
      AWS_REGION: "us-east-1",
      DEV_DEBUG_USERNAME: DEV_SEED.debugUsername,
      DEV_DEBUG_NAME: DEV_SEED.debugName,
      DEV_DEBUG_PASSWORD: "e2e-debug-local-only",
      DEV_ADMIN_USERNAME: DEV_SEED.adminUsername,
      DEV_ADMIN_NAME: DEV_SEED.adminName,
      DEV_ADMIN_PASSWORD: "e2e-admin-local-only",
    });
  });

  it("preserves explicit debug auth env overrides", () => {
    const env = buildPlaywrightServerEnv({
      host: "127.0.0.1",
      port: "3100",
      env: {
        DEV_DEBUG_USERNAME: "debug-override",
        DEV_DEBUG_NAME: "Debug Override",
        DEV_DEBUG_PASSWORD: "debug-secret",
        DEV_ADMIN_USERNAME: "admin-override",
        DEV_ADMIN_NAME: "Admin Override",
        DEV_ADMIN_PASSWORD: "admin-secret",
      },
    });

    expect(env).toMatchObject({
      DEV_DEBUG_USERNAME: "debug-override",
      DEV_DEBUG_NAME: "Debug Override",
      DEV_DEBUG_PASSWORD: "debug-secret",
      DEV_ADMIN_USERNAME: "admin-override",
      DEV_ADMIN_NAME: "Admin Override",
      DEV_ADMIN_PASSWORD: "admin-secret",
    });
  });
});
