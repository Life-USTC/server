import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authHandlerMock,
  getSessionFromHeadersMock,
  revokeAuthorizationMock,
  updateAuthorizationScopesMock,
} = vi.hoisted(() => ({
  authHandlerMock: vi.fn(),
  getSessionFromHeadersMock: vi.fn(),
  revokeAuthorizationMock: vi.fn(),
  updateAuthorizationScopesMock: vi.fn(),
}));

vi.mock("@/lib/auth/core", () => ({
  betterAuthInstance: { handler: authHandlerMock },
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

vi.mock("@/lib/auth/auth-origins", () => ({
  isTrustedAuthOrigin: (origin: string) => origin === "https://life.example",
}));

vi.mock("@/features/oauth/server/user-authorizations.server", () => ({
  revokeUserOAuthAuthorization: revokeAuthorizationMock,
  updateUserOAuthAuthorizationScopes: updateAuthorizationScopesMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthClient: { findUnique: vi.fn() },
  },
}));

function mutationRequest(
  path: string,
  body: Record<string, unknown>,
  origin = "https://life.example",
) {
  return new Request(`https://life.example/api/auth${path}`, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      cookie: "better-auth.session_token=session",
      origin,
    },
    method: "POST",
  });
}

describe("OAuth consent mutation routes", () => {
  beforeEach(() => {
    authHandlerMock.mockReset();
    getSessionFromHeadersMock.mockReset();
    revokeAuthorizationMock.mockReset();
    updateAuthorizationScopesMock.mockReset();
    getSessionFromHeadersMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("blocks direct use of the provider consent endpoint", async () => {
    const { authPostRoute } = await import("@/lib/api/routes/auth");

    const response = await authPostRoute(
      mutationRequest("/oauth2/consent", {
        accept: true,
        scope: "profile",
      }),
    );

    expect(response.status).toBe(404);
    expect(authHandlerMock).not.toHaveBeenCalled();
  });

  it("reimplements delete-consent through atomic token purge", async () => {
    revokeAuthorizationMock.mockResolvedValue({
      ok: true,
      deleted: {
        accessTokens: 1,
        consents: 1,
        deviceCodes: 1,
        refreshTokens: 1,
      },
    });
    const { authPostRoute } = await import("@/lib/api/routes/auth");

    const response = await authPostRoute(
      mutationRequest("/oauth2/delete-consent", { id: "consent-1" }),
    );

    expect(response.status).toBe(200);
    expect(revokeAuthorizationMock).toHaveBeenCalledWith("user-1", "consent-1");
    expect(authHandlerMock).not.toHaveBeenCalled();
  });

  it("rotates update-consent scopes through the safe grant service", async () => {
    updateAuthorizationScopesMock.mockResolvedValue({
      consentId: "consent-1",
      grantId: "grant-2",
      ok: true,
      scopes: ["profile"],
    });
    const { authPostRoute } = await import("@/lib/api/routes/auth");

    const response = await authPostRoute(
      mutationRequest("/oauth2/update-consent", {
        id: "consent-1",
        update: { scopes: ["profile"] },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "consent-1",
      scopes: ["profile"],
    });
    expect(updateAuthorizationScopesMock).toHaveBeenCalledWith(
      "user-1",
      "consent-1",
      ["profile"],
    );
    expect(authHandlerMock).not.toHaveBeenCalled();
  });

  it("rejects cross-origin consent mutations before session access", async () => {
    const { authPostRoute } = await import("@/lib/api/routes/auth");

    const response = await authPostRoute(
      mutationRequest(
        "/oauth2/delete-consent",
        { id: "consent-1" },
        "https://evil.example",
      ),
    );

    expect(response.status).toBe(403);
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
    expect(revokeAuthorizationMock).not.toHaveBeenCalled();
  });
});
