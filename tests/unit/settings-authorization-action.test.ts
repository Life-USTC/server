import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  logServerActionErrorMock,
  requireSettingsUserMock,
  resolveAuthoritativeRecentSessionMock,
  revokeUserOAuthAuthorizationMock,
} = vi.hoisted(() => ({
  logServerActionErrorMock: vi.fn(),
  requireSettingsUserMock: vi.fn(),
  resolveAuthoritativeRecentSessionMock: vi.fn(),
  revokeUserOAuthAuthorizationMock: vi.fn(),
}));

vi.mock("@/features/settings/server/settings-page-data", () => ({
  requireSettingsUser: requireSettingsUserMock,
}));

vi.mock("@/features/oauth/server/user-authorizations.server", () => ({
  revokeUserOAuthAuthorization: revokeUserOAuthAuthorizationMock,
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: vi.fn(),
  logServerActionError: logServerActionErrorMock,
}));

vi.mock("@/lib/audit/write-audit-log", () => ({
  fireAuditLog: vi.fn(),
  getAuditRequestMetadata: vi.fn(() => ({})),
}));

vi.mock("@/lib/auth/recent-session", () => ({
  resolveAuthoritativeRecentSession: resolveAuthoritativeRecentSessionMock,
}));

function request(origin?: string) {
  return new Request(
    "https://life.example/account/settings/authorizations?/revokeAuthorization",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: "better-auth.session_token=session-token",
        ...(origin ? { origin } : {}),
      },
      body: new URLSearchParams({ consentId: "consent-1" }),
    },
  );
}

describe("settings OAuth authorization action", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://life.example");
    requireSettingsUserMock.mockReset();
    resolveAuthoritativeRecentSessionMock.mockReset();
    revokeUserOAuthAuthorizationMock.mockReset();
    logServerActionErrorMock.mockReset();
    requireSettingsUserMock.mockResolvedValue({ id: "user-1" });
    resolveAuthoritativeRecentSessionMock.mockResolvedValue({
      ok: true,
      sessionId: "session-1",
      userId: "user-1",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    undefined,
    "https://evil.example",
  ])("rejects missing or untrusted CSRF origin: %s", async (origin) => {
    const { revokeSettingsAuthorizationAction } = await import(
      "@/features/settings/server/settings-authorization-actions"
    );

    await expect(
      revokeSettingsAuthorizationAction({
        locale: "en-us",
        request: request(origin),
        url: new URL("https://life.example/account/settings/authorizations"),
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(requireSettingsUserMock).not.toHaveBeenCalled();
    expect(revokeUserOAuthAuthorizationMock).not.toHaveBeenCalled();
  });

  it("requires the active session user and hides cross-user consent ids", async () => {
    revokeUserOAuthAuthorizationMock.mockResolvedValue({
      ok: false,
      reason: "not_found",
    });
    const { revokeSettingsAuthorizationAction } = await import(
      "@/features/settings/server/settings-authorization-actions"
    );

    const result = await revokeSettingsAuthorizationAction({
      locale: "en-us",
      request: request("https://life.example"),
      url: new URL("https://life.example/account/settings/authorizations"),
    });

    expect(requireSettingsUserMock).toHaveBeenCalledTimes(1);
    expect(revokeUserOAuthAuthorizationMock).toHaveBeenCalledWith(
      "user-1",
      "consent-1",
      expect.objectContaining({ channel: "web", sessionId: "session-1" }),
    );
    expect(result).toMatchObject({
      status: 404,
      data: {
        kind: "authorizations",
      },
    });
  });

  it("redirects to the canonical authorization list after revocation", async () => {
    revokeUserOAuthAuthorizationMock.mockResolvedValue({
      ok: true,
      deleted: {
        accessTokens: 1,
        consents: 1,
        deviceCodes: 1,
        refreshTokens: 1,
      },
    });
    const { revokeSettingsAuthorizationAction } = await import(
      "@/features/settings/server/settings-authorization-actions"
    );

    await expect(
      revokeSettingsAuthorizationAction({
        locale: "en-us",
        request: request("https://life.example"),
        url: new URL("https://life.example/account/settings/authorizations"),
      }),
    ).rejects.toMatchObject({
      location: "/account/settings/authorizations?message=AuthorizationRevoked",
      status: 303,
    });
  });

  it("returns a fail-closed error when the revocation transaction fails", async () => {
    revokeUserOAuthAuthorizationMock.mockRejectedValue(
      new Error("database unavailable"),
    );
    const { revokeSettingsAuthorizationAction } = await import(
      "@/features/settings/server/settings-authorization-actions"
    );

    const result = await revokeSettingsAuthorizationAction({
      locale: "en-us",
      request: request("https://life.example"),
      requestId: "request-revoke",
      url: new URL("https://life.example/account/settings/authorizations"),
    });

    expect(result).toMatchObject({
      status: 500,
      data: {
        kind: "authorizations",
      },
    });
    expect(logServerActionErrorMock).toHaveBeenCalledWith(
      "settings.authorization.revoke.failed",
      expect.any(Error),
      {
        action: "revoke-authorization",
        requestId: "request-revoke",
        route: "/account/settings/authorizations",
      },
    );
  });

  it("rejects stale sessions with explicit reauthentication guidance", async () => {
    resolveAuthoritativeRecentSessionMock.mockResolvedValue({
      ok: false,
      reason: "session_not_fresh",
      sessionId: "session-1",
      userId: "user-1",
    });
    const { revokeSettingsAuthorizationAction } = await import(
      "@/features/settings/server/settings-authorization-actions"
    );

    const result = await revokeSettingsAuthorizationAction({
      locale: "en-us",
      request: request("https://life.example"),
      url: new URL("https://life.example/account/settings/authorizations"),
    });
    expect(result).toMatchObject({
      status: 403,
      data: { message: expect.stringMatching(/sign out and sign in again/i) },
    });
    expect(revokeUserOAuthAuthorizationMock).not.toHaveBeenCalled();
  });
});
