import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MCP_TOOLS_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_REST_READ_SCOPE,
  OAUTH_REST_WRITE_SCOPE,
} from "@/lib/oauth/constants";

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
    verifyAccessTokenMock.mockResolvedValue({
      scope: OAUTH_REST_READ_SCOPE,
      sub: "user-from-token",
    });
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

  it.each([
    "bearer",
    "bEaReR",
  ])("accepts a %s bearer access token", async (scheme) => {
    verifyAccessTokenMock.mockResolvedValue({
      scope: OAUTH_REST_READ_SCOPE,
      sub: "user-from-token",
    });
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/me", {
      headers: {
        authorization: `${scheme} access-token`,
        cookie: "better-auth.session_token=session-token",
      },
    });

    await expect(resolveApiUserId(request)).resolves.toBe("user-from-token");
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
    expect(verifyAccessTokenMock).toHaveBeenCalledWith(
      "access-token",
      expect.any(Object),
    );
  });

  it.each([
    "bearer",
    "bEaReR",
  ])("treats a %s authorization header as an auth signal", async (scheme) => {
    const { hasRequestAuthSignal } = await import(
      "@/lib/auth/request-auth-signal"
    );

    expect(
      hasRequestAuthSignal(
        new Headers({ authorization: `${scheme} access-token` }),
      ),
    ).toBe(true);
  });

  it("rejects profile-only bearer access for protected REST reads", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      scope: OAUTH_PROFILE_SCOPE,
      sub: "user-from-token",
    });
    const { requireAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/me", {
      headers: {
        authorization: "Bearer profile-token",
      },
    });

    const result = await requireAuth(request);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    await expect((result as Response).json()).resolves.toEqual({
      error: "Unauthorized",
    });
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("rejects MCP-only bearer access for protected REST reads", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      scope: `${OAUTH_PROFILE_SCOPE} ${MCP_TOOLS_SCOPE}`,
      sub: "user-from-token",
    });
    const { requireAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/todos", {
      headers: {
        authorization: "Bearer mcp-token",
      },
    });

    const result = await requireAuth(request);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    await expect((result as Response).json()).resolves.toEqual({
      error: "Unauthorized",
    });
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("rejects REST read-only bearer access for protected REST writes", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      scope: OAUTH_REST_READ_SCOPE,
      sub: "user-from-token",
    });
    const { requireWriteAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/todos", {
      method: "POST",
      headers: {
        authorization: "Bearer read-token",
      },
    });

    const result = await requireWriteAuth(request);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    await expect((result as Response).json()).resolves.toEqual({
      error: "Unauthorized",
    });
    expect(getViewerAuthDataForUserIdMock).not.toHaveBeenCalled();
  });

  it("rejects REST read-only bearer access for POST routes using requireAuth", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      scope: OAUTH_REST_READ_SCOPE,
      sub: "user-from-token",
    });
    const { requireAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/todos", {
      method: "POST",
      headers: {
        authorization: "Bearer read-token",
      },
    });

    const result = await requireAuth(request);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    await expect((result as Response).json()).resolves.toEqual({
      error: "Unauthorized",
    });
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("rejects MCP-only bearer access for protected REST writes", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      scope: `${OAUTH_PROFILE_SCOPE} ${MCP_TOOLS_SCOPE}`,
      sub: "user-from-token",
    });
    const { requireWriteAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/todos", {
      method: "POST",
      headers: {
        authorization: "Bearer mcp-token",
      },
    });

    const result = await requireWriteAuth(request);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    await expect((result as Response).json()).resolves.toEqual({
      error: "Unauthorized",
    });
    expect(getViewerAuthDataForUserIdMock).not.toHaveBeenCalled();
  });

  it("does not fall back to session cookies when a bearer token is invalid", async () => {
    verifyAccessTokenMock.mockRejectedValue(new Error("invalid token"));
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "user-from-cookie" },
    });
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/me", {
      headers: {
        authorization: "Bearer invalid-token",
        cookie: "better-auth.session_token=session-token",
      },
    });

    await expect(resolveApiUserId(request)).resolves.toBeNull();
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("returns 401 instead of falling back to session cookies when a lowercase bearer token is invalid", async () => {
    verifyAccessTokenMock.mockRejectedValue(new Error("invalid token"));
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "user-from-cookie" },
    });
    const { requireAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/me", {
      headers: {
        authorization: "bearer invalid-token",
        cookie: "better-auth.session_token=session-token",
      },
    });

    const result = await requireAuth(request);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    await expect((result as Response).json()).resolves.toEqual({
      error: "Unauthorized",
    });
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("does not fall back to session cookies when a bearer token is empty", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "user-from-cookie" },
    });
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/me", {
      headers: {
        authorization: "Bearer ",
        cookie: "better-auth.session_token=session-token",
      },
    });

    await expect(resolveApiUserId(request)).resolves.toBeNull();
    expect(verifyAccessTokenMock).not.toHaveBeenCalled();
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("resolves session-only auth from cookies", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "user-from-cookie" },
    });
    const { resolveSessionUserId } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/admin/users", {
      headers: {
        cookie: "better-auth.session_token=session-token",
      },
    });

    await expect(resolveSessionUserId(request)).resolves.toBe(
      "user-from-cookie",
    );
    expect(getSessionFromHeadersMock).toHaveBeenCalledWith(request.headers);
    expect(verifyAccessTokenMock).not.toHaveBeenCalled();
  });

  it("rejects bearer authorization for session-only auth", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "user-from-cookie" },
    });
    const { resolveSessionUserId } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/admin/users", {
      headers: {
        authorization: "Bearer access-token",
        cookie: "better-auth.session_token=session-token",
      },
    });

    await expect(resolveSessionUserId(request)).resolves.toBeNull();
    expect(verifyAccessTokenMock).not.toHaveBeenCalled();
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("rejects write auth when the resolved user no longer exists", async () => {
    verifyAccessTokenMock.mockResolvedValue({
      scope: OAUTH_REST_WRITE_SCOPE,
      sub: "deleted-user",
    });
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
