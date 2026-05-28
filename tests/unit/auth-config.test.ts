import { afterEach, describe, expect, it, vi } from "vitest";

describe("auth config", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("allows debug auth in development without enabling E2E mode", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("E2E_DEBUG_AUTH", "");

    const { allowDebugAuth, allowE2EDebugAuth, isDevelopment } = await import(
      "@/lib/auth/auth-config"
    );

    expect(isDevelopment).toBe(true);
    expect(allowE2EDebugAuth).toBe(false);
    expect(allowDebugAuth).toBe(true);
  });

  it("allows E2E debug auth outside development when explicitly enabled", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_DEBUG_AUTH", "1");

    const { allowDebugAuth, allowE2EDebugAuth, isDevelopment } = await import(
      "@/lib/auth/auth-config"
    );

    expect(isDevelopment).toBe(false);
    expect(allowE2EDebugAuth).toBe(true);
    expect(allowDebugAuth).toBe(true);
  });

  it("rejects E2E debug auth on Vercel hosting", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_DEBUG_AUTH", "1");
    vi.stubEnv("VERCEL", "1");

    await expect(import("@/lib/auth/auth-config")).rejects.toThrow(
      "E2E_DEBUG_AUTH must not be set on Vercel/production hosting",
    );
  });
});
