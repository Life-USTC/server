import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  allowDebugAuthMock,
  authPrismaMock,
  buildPluginsMock,
  createBetterAuthPrismaAdapterMock,
} = vi.hoisted(() => ({
  allowDebugAuthMock: vi.fn(),
  authPrismaMock: { boundary: "auth" },
  buildPluginsMock: vi.fn(() => [{ id: "plugins" }]),
  createBetterAuthPrismaAdapterMock: vi.fn(() => ({ id: "adapter" })),
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
  createBetterAuthPrismaAdapter: createBetterAuthPrismaAdapterMock,
}));

vi.mock("@/lib/auth/better-auth-social-providers", () => ({
  buildBetterAuthSocialProviders: () => ({}),
}));

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: authPrismaMock,
}));

describe("Better Auth options", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    allowDebugAuthMock.mockReset();
    buildPluginsMock.mockClear();
    createBetterAuthPrismaAdapterMock.mockClear();
  });

  it("keeps password auth disabled and passkey abuse limits enabled in production", async () => {
    allowDebugAuthMock.mockReturnValue(false);
    const { buildBetterAuthOptions } = await import(
      "@/lib/auth/better-auth-options"
    );

    const options = buildBetterAuthOptions();

    expect(options.emailAndPassword.enabled).toBe(false);
    expect(createBetterAuthPrismaAdapterMock).toHaveBeenCalledWith(
      authPrismaMock,
    );
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
        "/webhook/login": {
          window: 60,
          max: 5,
        },
      },
    });
    expect(options.trustedOrigins).toEqual(["https://life.example.com"]);
    expect(options.session).toMatchObject({
      expiresIn: 60 * 60 * 24 * 30,
      freshAge: 15 * 60,
      updateAge: 60 * 60 * 24,
    });
    expect(options.databaseHooks).toEqual(expect.any(Object));
    expect(options.hooks).toMatchObject({
      after: expect.any(Function),
      before: expect.any(Function),
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

  it("user.debug-password-boundary", async () => {
    const { allowDebugAuth } = await vi.importActual<
      typeof import("@/lib/auth/auth-config")
    >("@/lib/auth/auth-config");
    allowDebugAuthMock.mockImplementation(allowDebugAuth);
    const { buildBetterAuthOptions } = await import(
      "@/lib/auth/better-auth-options"
    );
    for (const [environment, debug, enabled] of [
      ["development", "", true],
      ["test", "", false],
      ["test", "1", true],
      ["production", "", false],
    ] as const) {
      vi.stubEnv("NODE_ENV", environment);
      vi.stubEnv("E2E_DEBUG_AUTH", debug);
      expect(buildBetterAuthOptions().emailAndPassword).toEqual({
        enabled,
        disableSignUp: true,
        autoSignIn: false,
      });
    }
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_DEBUG_AUTH", "1");
    expect(() => buildBetterAuthOptions()).toThrow(
      "E2E_DEBUG_AUTH must not be set in production hosting",
    );
  });
});
