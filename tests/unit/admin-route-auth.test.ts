import { afterEach, describe, expect, it, vi } from "vitest";

const {
  getSessionFromHeadersMock,
  resolveAdminByUserIdMock,
  verifyAccessTokenMock,
} = vi.hoisted(() => ({
  getSessionFromHeadersMock: vi.fn(),
  resolveAdminByUserIdMock: vi.fn(),
  verifyAccessTokenMock: vi.fn(),
}));

vi.mock("@/features/admin/server/admin-api", () => ({
  resolveAdminByUserId: resolveAdminByUserIdMock,
}));

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

vi.mock("better-auth/oauth2", () => ({
  verifyAccessToken: verifyAccessTokenMock,
}));

vi.mock("@/lib/mcp/urls", () => ({
  getJwksUrlForOAuthVerification: () => "https://life.example/api/auth/jwks",
  getOAuthRestAudienceUrls: () => ["https://life.example/api/auth"],
  getOAuthTokenVerificationIssuers: () => ["https://life.example/api/auth"],
}));

describe("admin route auth", () => {
  afterEach(() => {
    getSessionFromHeadersMock.mockReset();
    resolveAdminByUserIdMock.mockReset();
    verifyAccessTokenMock.mockReset();
    vi.resetModules();
  });

  it("returns 401 when no session user is authenticated", async () => {
    getSessionFromHeadersMock.mockResolvedValue(null);
    resolveAdminByUserIdMock.mockResolvedValue(null);
    const { requireAdminRequest } = await import(
      "@/lib/api/routes/admin-route-auth"
    );

    const response = await requireAdminRequest(
      new Request("https://example.test/api/admin/homeworks/homework-1"),
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(401);
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
    expect(resolveAdminByUserIdMock).not.toHaveBeenCalled();
  });

  it("rejects bearer-only admin REST requests", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "admin-from-cookie" },
    });
    resolveAdminByUserIdMock.mockResolvedValue({ userId: "admin-from-token" });
    const { requireAdminRequest } = await import(
      "@/lib/api/routes/admin-route-auth"
    );

    const response = await requireAdminRequest(
      new Request("https://example.test/api/admin/homeworks/homework-1", {
        headers: {
          authorization: "Bearer access-token",
        },
      }),
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(401);
    expect(verifyAccessTokenMock).not.toHaveBeenCalled();
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
    expect(resolveAdminByUserIdMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the session user is not an admin", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "user-1" },
    });
    resolveAdminByUserIdMock.mockResolvedValue(null);
    const { requireAdminRequest } = await import(
      "@/lib/api/routes/admin-route-auth"
    );

    const response = await requireAdminRequest(
      new Request("https://example.test/api/admin/homeworks/homework-1", {
        headers: {
          cookie: "better-auth.session_token=session-token",
        },
      }),
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(401);
    expect(resolveAdminByUserIdMock).toHaveBeenCalledWith("user-1");
  });

  it("returns the admin session for a valid admin session cookie", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "admin-1" },
    });
    resolveAdminByUserIdMock.mockResolvedValue({ userId: "admin-1" });
    const { requireAdminRequest } = await import(
      "@/lib/api/routes/admin-route-auth"
    );
    const request = new Request(
      "https://example.test/api/admin/homeworks/homework-1",
      {
        headers: {
          cookie: "better-auth.session_token=session-token",
        },
      },
    );

    const admin = await requireAdminRequest(request);

    expect(admin).toEqual({ userId: "admin-1" });
    expect(getSessionFromHeadersMock).toHaveBeenCalledWith(request.headers);
    expect(resolveAdminByUserIdMock).toHaveBeenCalledWith("admin-1");
  });
});
