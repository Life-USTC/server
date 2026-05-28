import { afterEach, describe, expect, it, vi } from "vitest";

describe("dev seed runtime config", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("uses scenario defaults when env overrides are unset", async () => {
    const {
      DEV_SEED,
      getDevDebugCredentialConfig,
      getDevScenarioRuntimeConfig,
    } = await import("@tools/dev/seed/dev-seed");

    expect(getDevScenarioRuntimeConfig()).toEqual({
      debugUsername: DEV_SEED.debugUsername,
      debugName: DEV_SEED.debugName,
      adminUsername: DEV_SEED.adminUsername,
      adminName: DEV_SEED.adminName,
    });
    expect(getDevDebugCredentialConfig()).toMatchObject({
      debug: {
        username: DEV_SEED.debugUsername,
        name: DEV_SEED.debugName,
        email: `${DEV_SEED.debugUsername}@debug.local`,
        password: "dev-debug-password",
      },
      admin: {
        username: DEV_SEED.adminUsername,
        name: DEV_SEED.adminName,
        email: `${DEV_SEED.adminUsername}@debug.local`,
        password: "dev-admin-password",
      },
    });
  });

  it("trims and lowercases runtime overrides", async () => {
    vi.stubEnv("DEV_DEBUG_USERNAME", " Debug-User ");
    vi.stubEnv("DEV_DEBUG_NAME", " Debug Name ");
    vi.stubEnv("DEV_DEBUG_EMAIL", " Debug@Example.TEST ");
    vi.stubEnv("DEV_ADMIN_USERNAME", " Admin-User ");
    vi.stubEnv("DEV_ADMIN_NAME", " Admin Name ");
    vi.stubEnv("DEV_ADMIN_EMAIL", " Admin@Example.TEST ");
    vi.stubEnv("DEV_DEBUG_PASSWORD", " debug-pass ");
    vi.stubEnv("DEV_ADMIN_PASSWORD", " admin-pass ");

    const { getDevDebugCredentialConfig, getDevScenarioRuntimeConfig } =
      await import("@tools/dev/seed/dev-seed");

    expect(getDevScenarioRuntimeConfig()).toEqual({
      debugUsername: "debug-user",
      debugName: "Debug Name",
      adminUsername: "admin-user",
      adminName: "Admin Name",
    });
    expect(getDevDebugCredentialConfig()).toMatchObject({
      debug: {
        username: "debug-user",
        name: "Debug Name",
        email: "debug@example.test",
        password: "debug-pass",
      },
      admin: {
        username: "admin-user",
        name: "Admin Name",
        email: "admin@example.test",
        password: "admin-pass",
      },
    });
  });
});
