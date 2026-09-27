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

  it("user.passkey-server-boundary", async () => {
    const { buildBetterAuthPasskeyPlugin } = await import(
      "@/lib/auth/better-auth-passkey-plugin"
    );
    for (const config of [
      {
        mode: "production",
        canonical: "https://life.example.com",
        public: "https://preview.life.example.com",
        rp: "life.example.com",
        origins: [
          "https://life.example.com",
          "https://preview.life.example.com",
        ],
      },
      ...[
        "https://branch.workers.dev",
        "https://evil-life.example.com",
        "https://life.example.com.evil.test",
        "http://localhost:3000",
      ].map((origin) => ({
        mode: "production",
        canonical: "https://life.example.com",
        public: origin,
        rp: new URL(origin).hostname,
        origins: [origin],
      })),
      {
        mode: "development",
        canonical: "http://127.0.0.1:3000",
        public: "http://127.0.0.1:3000",
        rp: "localhost",
        origins: ["http://localhost:3000"],
      },
      {
        mode: "development",
        canonical: "http://[::1]:3000",
        public: "http://[::1]:3000",
        rp: "localhost",
        origins: ["http://localhost:3000"],
      },
      {
        mode: "development",
        canonical: "",
        public: "",
        rp: "localhost",
        origins: ["http://localhost:3000"],
      },
    ]) {
      passkeyMock.mockClear();
      vi.stubEnv("NODE_ENV", config.mode);
      vi.stubEnv("APP_CANONICAL_ORIGIN", config.canonical);
      vi.stubEnv("APP_PUBLIC_ORIGIN", config.public);
      buildBetterAuthPasskeyPlugin();
      expect(passkeyMock).toHaveBeenCalledExactlyOnceWith({
        rpID: config.rp,
        rpName: "Life@USTC",
        origin: config.origins,
        registration: { requireSession: true },
      });
    }
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_PHASE", "");
    for (const [canonical, publicOrigin] of [
      ["", ""],
      ["http://life.example.com", "http://life.example.com"],
      ["ftp://life.example.com", "https://life.example.com"],
      ["https://life.example.com", "http://branch.workers.dev"],
      ["https://life.example.com", "ftp://branch.workers.dev"],
    ]) {
      passkeyMock.mockClear();
      vi.stubEnv("APP_CANONICAL_ORIGIN", canonical);
      vi.stubEnv("APP_PUBLIC_ORIGIN", publicOrigin);
      expect(() => buildBetterAuthPasskeyPlugin()).toThrow();
      expect(passkeyMock).not.toHaveBeenCalled();
    }
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
  ])(
    "rejects an unsafe canonical origin %s",
    async (canonicalOrigin, publicOrigin) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("APP_CANONICAL_ORIGIN", canonicalOrigin);
      vi.stubEnv("APP_PUBLIC_ORIGIN", publicOrigin);

      const { buildBetterAuthPasskeyPlugin } = await import(
        "@/lib/auth/better-auth-passkey-plugin"
      );

      expect(() => buildBetterAuthPasskeyPlugin()).toThrow();
      expect(passkeyMock).not.toHaveBeenCalled();
    },
  );

  it("maps loopback IP origins to localhost for WebAuthn RP ID", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_CANONICAL_ORIGIN", "http://localhost:3000");
    vi.stubEnv("APP_PUBLIC_ORIGIN", "http://127.0.0.1:3000");

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

  it("maps an IP-literal public origin to localhost RP ID", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_CANONICAL_ORIGIN", "http://127.0.0.1:3000");
    vi.stubEnv("APP_PUBLIC_ORIGIN", "http://127.0.0.1:3000");

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
