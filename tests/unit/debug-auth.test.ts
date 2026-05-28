import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEV_ADMIN_PROVIDER_ID,
  DEV_DEBUG_PROVIDER_ID,
} from "@/lib/auth/provider-ids";

vi.mock("better-auth/crypto", () => ({
  hashPassword: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {},
}));

describe("debug auth config", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("builds default debug provider configs", async () => {
    const { getDebugProviderConfig } = await import("@/lib/auth/debug-auth");

    expect(getDebugProviderConfig(DEV_DEBUG_PROVIDER_ID)).toEqual({
      username: "dev-user",
      name: "Dev User",
      email: "dev-user@debug.local",
      password: "dev-debug-password",
      isAdmin: false,
      image: "https://api.dicebear.com/9.x/shapes/svg?seed=life-ustc-dev-user",
    });
    expect(getDebugProviderConfig(DEV_ADMIN_PROVIDER_ID)).toMatchObject({
      username: "dev-admin",
      name: "Dev Admin User",
      email: "dev-admin@debug.local",
      password: "dev-admin-password",
      isAdmin: true,
    });
  });

  it("trims and lowercases environment overrides", async () => {
    vi.stubEnv("DEV_DEBUG_USERNAME", "  Custom-User ");
    vi.stubEnv("DEV_DEBUG_NAME", " Custom User ");
    vi.stubEnv("DEV_DEBUG_EMAIL", " USER@Example.TEST ");
    vi.stubEnv("DEV_DEBUG_PASSWORD", " custom-password ");

    const { getDebugProviderConfig } = await import("@/lib/auth/debug-auth");

    expect(getDebugProviderConfig(DEV_DEBUG_PROVIDER_ID)).toMatchObject({
      username: "custom-user",
      name: "Custom User",
      email: "user@example.test",
      password: "custom-password",
    });
  });

  it("requires explicit debug passwords for non-development E2E auth", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_DEBUG_AUTH", "1");

    await expect(import("@/lib/auth/debug-auth")).rejects.toThrow(
      "DEV_DEBUG_PASSWORD is required when E2E_DEBUG_AUTH=1 (non-development NODE_ENV)",
    );
  });
});
