import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionFromHeadersMock = vi.fn();
const verifyAccessTokenMock = vi.fn();
const getViewerAuthDataForUserIdMock = vi.fn();

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {},
}));

vi.mock("better-auth/oauth2", () => ({
  verifyAccessToken: verifyAccessTokenMock,
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerAuthDataForUserId: getViewerAuthDataForUserIdMock,
}));

vi.mock("@/lib/mcp/urls", () => ({
  getJwksUrlForOAuthVerification: () => "https://life.example/api/auth/jwks",
  getOAuthRestAudienceUrls: () => ["https://life.example/api/auth"],
  getOAuthTokenVerificationIssuers: () => ["https://life.example/api/auth"],
}));

describe("auth helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    getSessionFromHeadersMock.mockReset();
    verifyAccessTokenMock.mockReset();
    getViewerAuthDataForUserIdMock.mockReset();
  });

  it("uses the route request headers for session-cookie fallback", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "user-from-cookie" },
    });
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/me", {
      headers: {
        cookie: "better-auth.session_token=session-token",
      },
    });

    await expect(resolveApiUserId(request)).resolves.toBe("user-from-cookie");
    expect(getSessionFromHeadersMock).toHaveBeenCalledWith(request.headers);
    expect(verifyAccessTokenMock).not.toHaveBeenCalled();
  });

  it("prefers a valid bearer access token over session cookies", async () => {
    verifyAccessTokenMock.mockResolvedValue({ sub: "user-from-token" });
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/me", {
      headers: {
        authorization: "Bearer access-token",
        cookie: "better-auth.session_token=session-token",
      },
    });

    await expect(resolveApiUserId(request)).resolves.toBe("user-from-token");
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
    expect(verifyAccessTokenMock).toHaveBeenCalledWith(
      "access-token",
      expect.objectContaining({
        jwksUrl: "https://life.example/api/auth/jwks",
        verifyOptions: {
          issuer: ["https://life.example/api/auth"],
          audience: ["https://life.example/api/auth"],
        },
      }),
    );
  });

  it("rejects write auth when the resolved user no longer exists", async () => {
    verifyAccessTokenMock.mockResolvedValue({ sub: "deleted-user" });
    getViewerAuthDataForUserIdMock.mockResolvedValue(null);
    const { requireWriteAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/comments", {
      method: "POST",
      headers: {
        authorization: "Bearer access-token",
      },
    });

    const result = await requireWriteAuth(request);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    expect(getViewerAuthDataForUserIdMock).toHaveBeenCalledWith("deleted-user");
  });
});
