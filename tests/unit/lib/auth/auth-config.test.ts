import { afterEach, describe, expect, it, vi } from "vitest";

describe("认证配置", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("允许开发环境调试认证但不启用 E2E 模式", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("E2E_DEBUG_AUTH", "");

    const { allowDebugAuth, allowE2EDebugAuth, isDevelopment } = await import(
      "@/lib/auth/auth-config"
    );

    expect(isDevelopment()).toBe(true);
    expect(allowE2EDebugAuth()).toBe(false);
    expect(allowDebugAuth()).toBe(true);
  });

  it("在开发环境外显式启用时允许 E2E 调试认证", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_DEBUG_AUTH", "1");

    const { allowDebugAuth, allowE2EDebugAuth, isDevelopment } = await import(
      "@/lib/auth/auth-config"
    );

    expect(isDevelopment()).toBe(false);
    expect(allowE2EDebugAuth()).toBe(true);
    expect(allowDebugAuth()).toBe(true);
  });

  it("在生产环境中拒绝 E2E 调试认证", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_DEBUG_AUTH", "1");

    const { allowDebugAuth } = await import("@/lib/auth/auth-config");
    expect(() => allowDebugAuth()).toThrow(
      "E2E_DEBUG_AUTH must not be set in production hosting",
    );
  });
});
