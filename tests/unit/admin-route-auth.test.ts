import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const {
  findActiveSuspensionMock,
  getSessionFromHeadersMock,
  hasActiveOAuthUserGrantMock,
  resolveAuthoritativeRecentSessionMock,
  resolveAdminByUserIdMock,
  verifyAccessTokenJwtMock,
} = vi.hoisted(() => ({
  findActiveSuspensionMock: vi.fn(),
  getSessionFromHeadersMock: vi.fn(),
  hasActiveOAuthUserGrantMock: vi.fn(),
  resolveAuthoritativeRecentSessionMock: vi.fn(),
  resolveAdminByUserIdMock: vi.fn(),
  verifyAccessTokenJwtMock: vi.fn(),
}));

vi.mock("@/features/admin/server/admin-api", () => ({
  resolveAdminByUserId: resolveAdminByUserIdMock,
}));

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  findActiveSuspension: findActiveSuspensionMock,
}));

vi.mock("@/lib/auth/jwt-verification", () => ({
  verifyAccessTokenJwt: verifyAccessTokenJwtMock,
}));

vi.mock("@/lib/oauth/active-user-grant", () => ({
  hasActiveOAuthUserGrant: hasActiveOAuthUserGrantMock,
}));

vi.mock("@/lib/auth/recent-session", () => ({
  resolveAuthoritativeRecentSession: resolveAuthoritativeRecentSessionMock,
}));

vi.mock("@/lib/mcp/urls", () => ({
  getJwksUrlForOAuthVerification: () => "https://life.example/api/auth/jwks",
  getOAuthRestAudienceUrls: () => ["https://life.example/api/auth"],
  getOAuthTokenVerificationIssuers: () => ["https://life.example/api/auth"],
}));

describe("admin 路由认证", () => {
  beforeEach(() => {
    setCloudflareRuntimeEnv(undefined);
    hasActiveOAuthUserGrantMock.mockResolvedValue(true);
    resolveAuthoritativeRecentSessionMock.mockResolvedValue({
      ok: true,
      sessionId: "session-1",
      userId: "admin-1",
    });
  });

  afterEach(() => {
    setCloudflareRuntimeEnv(undefined);
    findActiveSuspensionMock.mockReset();
    getSessionFromHeadersMock.mockReset();
    hasActiveOAuthUserGrantMock.mockReset();
    resolveAdminByUserIdMock.mockReset();
    resolveAuthoritativeRecentSessionMock.mockReset();
    verifyAccessTokenJwtMock.mockReset();
    vi.resetModules();
  });

  it("未认证会话用户时返回 401", async () => {
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

  it("拒绝管理员用户持有的 Bearer 令牌，管理员 REST 仅接受站内会话", async () => {
    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "admin-client",
      sub: "admin-from-token",
      scope: new Set(["account.profile:read"]),
      aud: "https://life.example/api/auth",
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
    expect(verifyAccessTokenJwtMock).not.toHaveBeenCalled();
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
    expect(hasActiveOAuthUserGrantMock).not.toHaveBeenCalled();
    expect(resolveAdminByUserIdMock).not.toHaveBeenCalled();
  });

  it("会话用户不是管理员时返回 401", async () => {
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

  it("为有效的管理员会话 cookie 返回管理员会话", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "admin-1" },
    });
    resolveAdminByUserIdMock.mockResolvedValue({ userId: "admin-1" });
    findActiveSuspensionMock.mockResolvedValue(null);
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

  it("管理员变更需要活跃管理员但该管理员被暂停时返回 403", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "admin-1" },
    });
    resolveAdminByUserIdMock.mockResolvedValue({ userId: "admin-1" });
    findActiveSuspensionMock.mockResolvedValue({
      reason: "policy hold",
    });
    const { requireAdminRequest } = await import(
      "@/lib/api/routes/admin-route-auth"
    );
    const request = new Request(
      "https://example.test/api/admin/comments/comment-1",
      {
        method: "DELETE",
        headers: {
          cookie: "better-auth.session_token=session-token",
        },
      },
    );

    const response = await requireAdminRequest(request);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(403);
    await expect((response as Response).json()).resolves.toEqual({
      error: "Suspended",
      reason: "policy hold",
    });
    expect(findActiveSuspensionMock).toHaveBeenCalledWith("admin-1");
  });

  it("暂停的管理员无法读取 moderation 队列", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "admin-1" },
    });
    resolveAdminByUserIdMock.mockResolvedValue({ userId: "admin-1" });
    findActiveSuspensionMock.mockResolvedValue({
      reason: "community hold",
    });
    const { requireAdminRequest } = await import(
      "@/lib/api/routes/admin-route-auth"
    );

    const response = await requireAdminRequest(
      new Request("https://example.test/api/admin/comments", {
        headers: { cookie: "better-auth.session_token=session-token" },
      }),
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(403);
    await expect((response as Response).json()).resolves.toEqual({
      error: "Suspended",
      reason: "community hold",
    });
  });

  it("管理员读取不消耗写入预算", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    setCloudflareRuntimeEnv({ USER_WRITE_RATE_LIMITER: { limit } });
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "admin-1" },
    });
    resolveAdminByUserIdMock.mockResolvedValue({ userId: "admin-1" });
    findActiveSuspensionMock.mockResolvedValue(null);
    const { requireAdminRequest } = await import(
      "@/lib/api/routes/admin-route-auth"
    );

    await expect(
      requireAdminRequest(
        new Request("https://example.test/api/admin/comments", {
          headers: { cookie: "better-auth.session_token=session-token" },
        }),
      ),
    ).resolves.toEqual({ userId: "admin-1" });
    expect(limit).not.toHaveBeenCalled();
  });

  it("敏感管理员变更要求服务端确认 recent-auth", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "admin-1" },
    });
    resolveAdminByUserIdMock.mockResolvedValue({ userId: "admin-1" });
    findActiveSuspensionMock.mockResolvedValue(null);
    resolveAuthoritativeRecentSessionMock.mockResolvedValue({
      ok: false,
      reason: "session_not_fresh",
      sessionId: "session-1",
      userId: "admin-1",
    });
    const { requireAdminRequest } = await import(
      "@/lib/api/routes/admin-route-auth"
    );
    const request = new Request("https://example.test/api/admin/users/user-1", {
      method: "PATCH",
      headers: { cookie: "better-auth.session_token=session-token" },
    });

    const response = await requireAdminRequest(request, {
      requireRecent: true,
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(403);
    await expect((response as Response).json()).resolves.toEqual({
      code: "RECENT_AUTH_REQUIRED",
      error:
        "Recent authentication required. Sign out and sign in again before retrying.",
    });
    expect(resolveAuthoritativeRecentSessionMock).toHaveBeenCalledWith(
      request.headers,
      { expectedUserId: "admin-1" },
    );
  });

  it("recent-auth 有效时允许敏感管理员变更继续", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "admin-1" },
    });
    resolveAdminByUserIdMock.mockResolvedValue({ userId: "admin-1" });
    findActiveSuspensionMock.mockResolvedValue(null);
    const { requireAdminRequest } = await import(
      "@/lib/api/routes/admin-route-auth"
    );

    await expect(
      requireAdminRequest(
        new Request("https://example.test/api/admin/suspensions", {
          method: "POST",
          headers: { cookie: "better-auth.session_token=session-token" },
        }),
        { requireRecent: true },
      ),
    ).resolves.toEqual({ userId: "admin-1" });
    expect(resolveAuthoritativeRecentSessionMock).toHaveBeenCalledTimes(1);
  });

  it("管理员写入超过预算时在业务处理前返回 429", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    setCloudflareRuntimeEnv({ USER_WRITE_RATE_LIMITER: { limit } });
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "admin-1" },
    });
    resolveAdminByUserIdMock.mockResolvedValue({ userId: "admin-1" });
    findActiveSuspensionMock.mockResolvedValue(null);
    const { requireAdminRequest } = await import(
      "@/lib/api/routes/admin-route-auth"
    );

    const response = await requireAdminRequest(
      new Request("https://example.test/api/admin/comments/comment-1", {
        method: "DELETE",
        headers: { cookie: "better-auth.session_token=session-token" },
      }),
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(429);
    expect((response as Response).headers.get("Retry-After")).toBe("60");
    expect(limit).toHaveBeenCalledWith({
      key: JSON.stringify([
        "user-mutation:v1",
        "example.test",
        "admin:comments:write",
        "admin-1",
      ]),
    });
  });

  it("百分号编码的管理员路径仍使用规范资源预算", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    setCloudflareRuntimeEnv({ USER_WRITE_RATE_LIMITER: { limit } });
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "admin-1" },
    });
    resolveAdminByUserIdMock.mockResolvedValue({ userId: "admin-1" });
    const { requireAdminRequest } = await import(
      "@/lib/api/routes/admin-route-auth"
    );

    await expect(
      requireAdminRequest(
        new Request("https://example.test/api/admin/%63omments/comment-1", {
          method: "DELETE",
          headers: { cookie: "better-auth.session_token=session-token" },
        }),
      ),
    ).resolves.toEqual({ userId: "admin-1" });
    expect(limit).toHaveBeenCalledWith({
      key: JSON.stringify([
        "user-mutation:v1",
        "example.test",
        "admin:comments:write",
        "admin-1",
      ]),
    });
  });
});
