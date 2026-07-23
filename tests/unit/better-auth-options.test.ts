import { beforeEach, describe, expect, it, vi } from "vitest";

const { allowDebugAuthMock, buildPluginsMock } = vi.hoisted(() => ({
  allowDebugAuthMock: vi.fn(),
  buildPluginsMock: vi.fn(() => [{ id: "plugins" }]),
}));

vi.mock("@/lib/auth/auth-config", () => ({
  allowDebugAuth: allowDebugAuthMock,
  getBetterAuthSecret: () => "test-secret",
}));

vi.mock("@/lib/auth/auth-origins", () => ({
  getAuthAllowedHosts: () => ["life.example.com"],
  getAuthTrustedOrigins: () => ["https://life.example.com"],
}));

vi.mock("@/lib/auth/better-auth-api-errors", () => ({
  betterAuthApiErrorHandler: {},
}));

vi.mock("@/lib/auth/better-auth-option-env", () => ({
  getBetterAuthOptionEnv: () => ({
    authEnv: {},
    authPublicOrigin: "https://life.example.com",
    authPublicProtocol: "https",
    oauthProxySecret: undefined,
    oidcDiscoveryUrl:
      "https://oidc.example.com/.well-known/openid-configuration",
    oidcIssuer: "https://oidc.example.com",
  }),
}));

vi.mock("@/lib/auth/better-auth-plugins", () => ({
  buildBetterAuthPlugins: buildPluginsMock,
}));

vi.mock("@/lib/auth/better-auth-prisma-adapter", () => ({
  createBetterAuthPrismaAdapter: () => ({ id: "adapter" }),
}));

vi.mock("@/lib/auth/better-auth-social-providers", () => ({
  buildBetterAuthSocialProviders: () => ({}),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {},
}));

describe("Better Auth options", () => {
  beforeEach(() => {
    allowDebugAuthMock.mockReset();
    buildPluginsMock.mockClear();
  });

  it("keeps password auth disabled and passkey abuse limits enabled in production", async () => {
    allowDebugAuthMock.mockReturnValue(false);
    const { buildBetterAuthOptions } = await import(
      "@/lib/auth/better-auth-options"
    );

    const options = buildBetterAuthOptions();

    expect(options.emailAndPassword.enabled).toBe(false);
    expect(options.rateLimit).toEqual({
      enabled: true,
      customRules: {
        "/passkey/generate-authenticate-options": {
          window: 60,
          max: 20,
        },
        "/passkey/verify-authentication": {
          window: 60,
          max: 10,
        },
      },
    });
    expect(options.trustedOrigins).toEqual(["https://life.example.com"]);
    expect(options.session).toMatchObject({
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    });
    expect(options.advanced).toMatchObject({
      disableCSRFCheck: false,
      disableOriginCheck: false,
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
    });
  });

  it("enables password auth only with debug auth and disables its request limiter", async () => {
    allowDebugAuthMock.mockReturnValue(true);
    const { buildBetterAuthOptions } = await import(
      "@/lib/auth/better-auth-options"
    );

    const options = buildBetterAuthOptions();

    expect(options.emailAndPassword.enabled).toBe(true);
    expect(options.rateLimit).toEqual({ enabled: false });
  });
});
