import { afterEach, describe, expect, it, vi } from "vitest";

const { passkeyMock } = vi.hoisted(() => ({
  passkeyMock: vi.fn((options) => ({ id: "passkey", options })),
}));

vi.mock("@better-auth/passkey", () => ({
  passkey: passkeyMock,
}));

describe("Better Auth passkey plugin", () => {
  afterEach(() => {
    passkeyMock.mockClear();
    vi.unstubAllEnvs();
  });

  it("uses the configured canonical RP and explicit preview origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_CANONICAL_ORIGIN", "https://life.example.com");
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://preview.life.example.com");

    const { buildBetterAuthPasskeyPlugin } = await import(
      "@/lib/auth/better-auth-passkey-plugin"
    );

    buildBetterAuthPasskeyPlugin();

    expect(passkeyMock).toHaveBeenCalledWith({
      rpID: "life.example.com",
      rpName: "Life@USTC",
      origin: ["https://life.example.com", "https://preview.life.example.com"],
      registration: {
        requireSession: true,
      },
    });
  });

  it("uses only the localhost RP origin when no development origin is set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_CANONICAL_ORIGIN", "");
    vi.stubEnv("APP_PUBLIC_ORIGIN", "");

    const { buildBetterAuthPasskeyPlugin } = await import(
      "@/lib/auth/better-auth-passkey-plugin"
    );

    buildBetterAuthPasskeyPlugin();

    expect(passkeyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rpID: "localhost",
        origin: ["http://localhost:3000"],
      }),
    );
  });

  it("accepts an explicit origin on a subdomain of the canonical RP", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_CANONICAL_ORIGIN", "https://life.example.com");
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://preview.life.example.com");

    const { buildBetterAuthPasskeyPlugin } = await import(
      "@/lib/auth/better-auth-passkey-plugin"
    );

    expect(() => buildBetterAuthPasskeyPlugin()).not.toThrow();
  });

  it("fails closed when production has no configured origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_PHASE", "");
    vi.stubEnv("APP_CANONICAL_ORIGIN", "");
    vi.stubEnv("APP_PUBLIC_ORIGIN", "");

    const { buildBetterAuthPasskeyPlugin } = await import(
      "@/lib/auth/better-auth-passkey-plugin"
    );

    expect(() => buildBetterAuthPasskeyPlugin()).toThrow(
      "APP_CANONICAL_ORIGIN or APP_PUBLIC_ORIGIN is required for passkeys in production",
    );
    expect(passkeyMock).not.toHaveBeenCalled();
  });

  it.each([
    ["ftp://life.example.com", "https://life.example.com"],
    ["http://life.example.com", "http://life.example.com"],
  ])("rejects an unsafe canonical origin %s", async (canonicalOrigin, publicOrigin) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_CANONICAL_ORIGIN", canonicalOrigin);
    vi.stubEnv("APP_PUBLIC_ORIGIN", publicOrigin);

    const { buildBetterAuthPasskeyPlugin } = await import(
      "@/lib/auth/better-auth-passkey-plugin"
    );

    expect(() => buildBetterAuthPasskeyPlugin()).toThrow();
    expect(passkeyMock).not.toHaveBeenCalled();
  });

  it.each([
    "https://branch.workers.dev",
    "https://evil-life.example.com",
  ])("rejects origin %s when it cannot use the canonical RP ID", async (publicOrigin) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_CANONICAL_ORIGIN", "https://life.example.com");
    vi.stubEnv("APP_PUBLIC_ORIGIN", publicOrigin);

    const { buildBetterAuthPasskeyPlugin } = await import(
      "@/lib/auth/better-auth-passkey-plugin"
    );

    expect(() => buildBetterAuthPasskeyPlugin()).toThrow(
      /is not compatible with RP ID life\.example\.com/,
    );
    expect(passkeyMock).not.toHaveBeenCalled();
  });

  it("does not mix localhost and 127.0.0.1 under one local RP ID", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_CANONICAL_ORIGIN", "http://localhost:3000");
    vi.stubEnv("APP_PUBLIC_ORIGIN", "http://127.0.0.1:3000");

    const { buildBetterAuthPasskeyPlugin } = await import(
      "@/lib/auth/better-auth-passkey-plugin"
    );

    expect(() => buildBetterAuthPasskeyPlugin()).toThrow(
      "Non-local passkey origins must use https",
    );
    expect(passkeyMock).not.toHaveBeenCalled();
  });

  it("rejects an IP literal as a local WebAuthn RP ID", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_CANONICAL_ORIGIN", "http://127.0.0.1:3000");
    vi.stubEnv("APP_PUBLIC_ORIGIN", "http://127.0.0.1:3000");

    const { buildBetterAuthPasskeyPlugin } = await import(
      "@/lib/auth/better-auth-passkey-plugin"
    );

    expect(() => buildBetterAuthPasskeyPlugin()).toThrow(
      "Non-local passkey origins must use https",
    );
    expect(passkeyMock).not.toHaveBeenCalled();
  });

  it("limits only the anonymous authentication endpoints", async () => {
    const { betterAuthPasskeyRateLimitRules } = await import(
      "@/lib/auth/better-auth-passkey-plugin"
    );

    expect(betterAuthPasskeyRateLimitRules).toEqual({
      "/passkey/generate-authenticate-options": {
        window: 60,
        max: 20,
      },
      "/passkey/verify-authentication": {
        window: 60,
        max: 10,
      },
    });
    expect(Object.keys(betterAuthPasskeyRateLimitRules)).not.toContain(
      "/passkey/list-user-passkeys",
    );
    expect(Object.keys(betterAuthPasskeyRateLimitRules)).not.toContain(
      "/passkey/delete-passkey",
    );
  });
});
