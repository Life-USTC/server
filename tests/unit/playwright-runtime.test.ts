import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildPlaywrightServerEnv,
  preparePlaywrightStandaloneRuntime,
  resolvePlaywrightHarnessRuntime,
} from "@tools/dev/e2e";
import { DEV_SEED } from "@tools/dev/seed/dev-seed";
import { describe, expect, it } from "vitest";

describe("playwright runtime", () => {
  it("uses pinned retry and timeout settings", () => {
    expect(resolvePlaywrightHarnessRuntime({}).retries).toBe(0);
    expect(resolvePlaywrightHarnessRuntime({ CI: "1" }).retries).toBe(2);
    expect(resolvePlaywrightHarnessRuntime({}).webServerTimeoutMs).toBe(
      300_000,
    );
  });

  it("uses the pinned Playwright host and port", () => {
    expect(resolvePlaywrightHarnessRuntime({})).toMatchObject({
      host: "127.0.0.1",
      port: "3000",
      baseUrl: "http://127.0.0.1:3000",
    });
  });

  it("resolves CI once into Playwright settings", () => {
    expect(
      resolvePlaywrightHarnessRuntime({
        CI: "1",
      }),
    ).toMatchObject({
      forbidOnly: true,
      reporter: [["github"]],
      retries: 2,
      reuseExistingServer: false,
      screenshot: "only-on-failure",
      trace: "on-first-retry",
    });
  });

  it("builds default debug auth env from dev seed data", () => {
    const env = buildPlaywrightServerEnv({
      host: "127.0.0.1",
      port: "3000",
      env: {},
    });

    expect(env).toMatchObject({
      PORT: "3000",
      ORIGIN: "http://127.0.0.1:3000",
      APP_PUBLIC_ORIGIN: "http://127.0.0.1:3000",
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

  it("sets the pinned port without rewriting unrelated env", () => {
    const env = buildPlaywrightServerEnv({
      host: "127.0.0.1",
      port: "3000",
      env: {
        ALL_PROXY: "http://proxy.local:8080",
        all_proxy: "http://proxy.local:8080",
        HTTPS_PROXY: "https://proxy.local:8080",
      },
    });

    expect(env).toMatchObject({
      PORT: "3000",
      ALL_PROXY: "http://proxy.local:8080",
      all_proxy: "http://proxy.local:8080",
      HTTPS_PROXY: "https://proxy.local:8080",
    });
  });

  it("merges public assets without deleting SvelteKit client assets", () => {
    const root = mkdtempSync(path.join(tmpdir(), "life-ustc-playwright-"));
    try {
      mkdirSync(path.join(root, "build", "client"), { recursive: true });
      mkdirSync(path.join(root, "public", "images"), { recursive: true });
      writeFileSync(path.join(root, "build", "index.js"), "");
      writeFileSync(path.join(root, "build", "client", "app.js"), "");
      writeFileSync(path.join(root, "public", "images", "icon.png"), "");

      preparePlaywrightStandaloneRuntime(root);

      expect(existsSync(path.join(root, "build", "client", "app.js"))).toBe(
        true,
      );
      expect(
        existsSync(path.join(root, "build", "client", "images", "icon.png")),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
