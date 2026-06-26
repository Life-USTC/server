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
  appendLocalNoProxy,
  buildPlaywrightServerEnv,
  E2E_WORKER_ARTIFACT_DIR,
  preparePlaywrightWorkerRuntime,
  resolvePlaywrightHarnessRuntime,
  validatePlaywrightWorkerRuntime,
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

  it("uses the default Playwright host and port", () => {
    expect(resolvePlaywrightHarnessRuntime({})).toMatchObject({
      host: "127.0.0.1",
      port: "3000",
      baseUrl: "http://127.0.0.1:3000",
    });
  });

  it("honors the local Playwright port override", () => {
    expect(
      resolvePlaywrightHarnessRuntime({ PLAYWRIGHT_PORT: "3100" }),
    ).toMatchObject({
      host: "127.0.0.1",
      port: "3100",
      baseUrl: "http://127.0.0.1:3100",
    });
  });

  it("derives the server port from a Playwright base URL override", () => {
    expect(
      resolvePlaywrightHarnessRuntime({
        PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3101",
      }),
    ).toMatchObject({
      host: "127.0.0.1",
      port: "3101",
      baseUrl: "http://127.0.0.1:3101",
    });
  });

  it("uses the base URL port when both Playwright URL variables are set", () => {
    expect(
      resolvePlaywrightHarnessRuntime({
        PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3102",
        PLAYWRIGHT_PORT: "3103",
      }),
    ).toMatchObject({
      port: "3102",
      baseUrl: "http://127.0.0.1:3102",
    });
  });

  it("rejects Playwright base URLs that cannot match the spawned local server", () => {
    expect(() =>
      resolvePlaywrightHarnessRuntime({
        PLAYWRIGHT_BASE_URL: "https://example.test:3102",
      }),
    ).toThrow(/must use http/);
    expect(() =>
      resolvePlaywrightHarnessRuntime({
        PLAYWRIGHT_BASE_URL: "https://127.0.0.1:3102",
      }),
    ).toThrow(/must use http/);
    expect(() =>
      resolvePlaywrightHarnessRuntime({
        PLAYWRIGHT_BASE_URL: "http://127.0.0.1",
      }),
    ).toThrow(/explicit port/);
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
      env: {
        DATABASE_URL: "postgresql://example",
      },
    });

    expect(env).toMatchObject({
      PORT: "3000",
      ORIGIN: "http://127.0.0.1:3000",
      APP_PUBLIC_ORIGIN: "http://127.0.0.1:3000",
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:
        "postgresql://example",
      E2E_DEBUG_AUTH: "1",
      DEV_DEBUG_USERNAME: DEV_SEED.debugUsername,
      DEV_DEBUG_NAME: DEV_SEED.debugName,
      DEV_DEBUG_EMAIL: `${DEV_SEED.debugUsername}@debug.local`,
      DEV_DEBUG_PASSWORD: "dev-debug-password",
      DEV_ADMIN_USERNAME: DEV_SEED.adminUsername,
      DEV_ADMIN_NAME: DEV_SEED.adminName,
      DEV_ADMIN_EMAIL: `${DEV_SEED.adminUsername}@debug.local`,
      DEV_ADMIN_PASSWORD: "dev-admin-password",
    });
  });

  it("honors debug credential overrides from the provided E2E env", () => {
    const env = buildPlaywrightServerEnv({
      host: "127.0.0.1",
      port: "3000",
      env: {
        DATABASE_URL: "postgresql://example",
        DEV_DEBUG_USERNAME: " Custom-Debug ",
        DEV_DEBUG_NAME: " Custom Debug ",
        DEV_DEBUG_EMAIL: " Debug@Example.TEST ",
        DEV_DEBUG_PASSWORD: " debug-secret ",
        DEV_ADMIN_USERNAME: " Custom-Admin ",
        DEV_ADMIN_NAME: " Custom Admin ",
        DEV_ADMIN_EMAIL: " Admin@Example.TEST ",
        DEV_ADMIN_PASSWORD: " admin-secret ",
      },
    });

    expect(env).toMatchObject({
      E2E_DEBUG_AUTH: "1",
      DEV_DEBUG_USERNAME: "custom-debug",
      DEV_DEBUG_NAME: "Custom Debug",
      DEV_DEBUG_EMAIL: "debug@example.test",
      DEV_DEBUG_PASSWORD: "debug-secret",
      DEV_ADMIN_USERNAME: "custom-admin",
      DEV_ADMIN_NAME: "Custom Admin",
      DEV_ADMIN_EMAIL: "admin@example.test",
      DEV_ADMIN_PASSWORD: "admin-secret",
    });
  });

  it("sets the pinned port without rewriting unrelated env", () => {
    const env = buildPlaywrightServerEnv({
      host: "127.0.0.1",
      port: "3000",
      env: {
        ALL_PROXY: "http://proxy.local:8080",
        DATABASE_URL: "postgresql://example",
        all_proxy: "http://proxy.local:8080",
        HTTPS_PROXY: "https://proxy.local:8080",
      },
    });

    expect(env).toMatchObject({
      PORT: "3000",
      NO_PROXY: "127.0.0.1,localhost,::1",
      no_proxy: "127.0.0.1,localhost,::1",
    });
    expect(env.ALL_PROXY).toBeUndefined();
    expect(env.all_proxy).toBeUndefined();
    expect(env.HTTPS_PROXY).toBeUndefined();
  });

  it("centralizes local no-proxy merging", () => {
    expect(appendLocalNoProxy(undefined)).toBe("127.0.0.1,localhost,::1");
    expect(appendLocalNoProxy("internal.local")).toBe(
      "internal.local,127.0.0.1,localhost,::1",
    );
  });

  it("prepares the named E2E Worker artifact contract", () => {
    const root = mkdtempSync(path.join(tmpdir(), "life-ustc-playwright-"));
    try {
      mkdirSync(path.join(root, ".svelte-kit", "cloudflare"), {
        recursive: true,
      });
      mkdirSync(path.join(root, ".svelte-kit", "cloudflare-tmp"), {
        recursive: true,
      });
      mkdirSync(path.join(root, ".svelte-kit", "output", "server"), {
        recursive: true,
      });
      mkdirSync(path.join(root, ".svelte-kit", "output", "server", "chunks"), {
        recursive: true,
      });
      mkdirSync(path.join(root, ".svelte-kit", "generated", "client"), {
        recursive: true,
      });
      writeFileSync(
        path.join(root, ".svelte-kit", "cloudflare", "_worker.js"),
        "",
      );
      writeFileSync(
        path.join(root, ".svelte-kit", "cloudflare-tmp", "manifest.js"),
        "",
      );
      writeFileSync(
        path.join(root, ".svelte-kit", "output", "server", "index.js"),
        "",
      );
      writeFileSync(
        path.join(root, ".svelte-kit", "output", "server", "chunks", "app.js"),
        "",
      );
      writeFileSync(
        path.join(root, ".svelte-kit", "generated", "client", "app.js"),
        "",
      );

      expect(() => preparePlaywrightWorkerRuntime(root)).not.toThrow();
      expect(() => validatePlaywrightWorkerRuntime(root)).not.toThrow();
      expect(
        existsSync(
          path.join(root, E2E_WORKER_ARTIFACT_DIR, "cloudflare", "_worker.js"),
        ),
      ).toBe(true);
      expect(
        existsSync(
          path.join(
            root,
            E2E_WORKER_ARTIFACT_DIR,
            "output",
            "server",
            "chunks",
            "app.js",
          ),
        ),
      ).toBe(true);
      expect(
        existsSync(
          path.join(root, E2E_WORKER_ARTIFACT_DIR, "generated", "client"),
        ),
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("validates the named E2E Worker artifact before startup", () => {
    const root = mkdtempSync(path.join(tmpdir(), "life-ustc-playwright-"));
    try {
      expect(() => validatePlaywrightWorkerRuntime(root)).toThrow(
        /Missing E2E Worker artifact file: build\/e2e-worker\/cloudflare\/_worker\.js/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
