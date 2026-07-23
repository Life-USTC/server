import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import {
  OAUTH_PROFILE_SCOPE,
  PUBLIC_REST_FEATURES,
  restReadScope,
  restWriteScope,
} from "@/lib/oauth/constants";
import { expandScopeClaim } from "@/lib/oauth/scope-registry";

const ALL_PUBLIC_READ_SCOPES = PUBLIC_REST_FEATURES.map(restReadScope);
const ALL_PUBLIC_WRITE_SCOPES = PUBLIC_REST_FEATURES.map(restWriteScope);
const UNRELATED_SCOPE = restReadScope("catalog.bus");

const getSessionFromHeadersMock = vi.fn();
const verifyAccessTokenJwtMock = vi.fn();
const getViewerAuthDataForUserIdMock = vi.fn();
const hasActiveOAuthUserGrantMock = vi.fn();

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/auth/jwt-verification", () => ({
  verifyAccessTokenJwt: verifyAccessTokenJwtMock,
}));

vi.mock("@/lib/oauth/active-user-grant", () => ({
  hasActiveOAuthUserGrant: hasActiveOAuthUserGrantMock,
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerAuthDataForUserId: getViewerAuthDataForUserIdMock,
}));

vi.mock("@/lib/mcp/urls", () => ({
  getJwksUrlForOAuthVerification: () => "https://life.example/api/auth/jwks",
  getOAuthRestAudienceUrls: () => ["https://life.example/api/auth"],
  getOAuthTokenVerificationIssuers: () => ["https://life.example/api/auth"],
}));

describe("认证辅助函数", () => {
  beforeEach(() => {
    setCloudflareRuntimeEnv(undefined);
    vi.resetModules();
    getSessionFromHeadersMock.mockReset();
    verifyAccessTokenJwtMock.mockReset();
    getViewerAuthDataForUserIdMock.mockReset();
    hasActiveOAuthUserGrantMock.mockReset();
    hasActiveOAuthUserGrantMock.mockResolvedValue(true);
  });

  afterEach(() => {
    setCloudflareRuntimeEnv(undefined);
  });

  it("使用路由请求头进行 session cookie 回退", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "user-from-cookie" },
    });
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/account/profile", {
      headers: {
        cookie: "better-auth.session_token=session-token",
      },
    });

    await expect(resolveApiUserId(request)).resolves.toBe("user-from-cookie");
    expect(getSessionFromHeadersMock).toHaveBeenCalledWith(request.headers);
    expect(verifyAccessTokenJwtMock).not.toHaveBeenCalled();
  });

  it("优先使用有效的 bearer 访问令牌而非 session cookie", async () => {
    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-id",
      scope: expandScopeClaim(ALL_PUBLIC_READ_SCOPES),
      sub: "user-from-token",
    });
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/account/profile", {
      headers: {
        authorization: "Bearer access-token",
        cookie: "better-auth.session_token=session-token",
      },
    });

    await expect(resolveApiUserId(request)).resolves.toBe("user-from-token");
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
    expect(verifyAccessTokenJwtMock).toHaveBeenCalledWith(
      "access-token",
      expect.objectContaining({
        jwksUrl: "https://life.example/api/auth/jwks",
        issuer: ["https://life.example/api/auth"],
        audience: ["https://life.example/api/auth"],
      }),
    );
  });

  it.each(["bearer", "bEaReR"])("接受 %s bearer 访问令牌", async (scheme) => {
    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-id",
      scope: new Set(["account.profile:read"]),
      sub: "user-from-token",
    });
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/account/profile", {
      headers: {
        authorization: `${scheme} access-token`,
        cookie: "better-auth.session_token=session-token",
      },
    });

    await expect(resolveApiUserId(request)).resolves.toBe("user-from-token");
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
    expect(verifyAccessTokenJwtMock).toHaveBeenCalledWith(
      "access-token",
      expect.any(Object),
    );
  });

  it("拒绝已撤销、缺少 azp 或无法查询授权状态的 REST JWT", async () => {
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/account/profile", {
      headers: { authorization: "Bearer access-token" },
    });

    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-id",
      scope: new Set(["account.profile:read"]),
      sub: "user-from-token",
    });
    hasActiveOAuthUserGrantMock.mockResolvedValueOnce(false);
    await expect(resolveApiUserId(request)).resolves.toBeNull();

    verifyAccessTokenJwtMock.mockResolvedValue({
      scope: new Set(["account.profile:read"]),
      sub: "user-from-token",
    });
    await expect(resolveApiUserId(request)).resolves.toBeNull();

    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-id",
      scope: new Set(["account.profile:read"]),
      sub: "user-from-token",
    });
    hasActiveOAuthUserGrantMock.mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    await expect(resolveApiUserId(request)).resolves.toBeNull();
  });

  it.each([
    "bearer",
    "bEaReR",
  ])("将 %s authorization 标头视为认证信号", async (scheme) => {
    const { hasRequestAuthSignal } = await import(
      "@/lib/auth/request-auth-signal"
    );

    expect(
      hasRequestAuthSignal(
        new Headers({ authorization: `${scheme} access-token` }),
      ),
    ).toBe(true);
  });

  it("拒绝仅 profile 的 bearer 访问受保护 REST 读取", async () => {
    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-id",
      scope: new Set([OAUTH_PROFILE_SCOPE]),
      sub: "user-from-token",
    });
    const { requireAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/account/profile", {
      headers: {
        authorization: "Bearer profile-token",
      },
    });

    const result = await requireAuth(request, {
      bearerScope: { feature: "account.profile", action: "read" },
    });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    await expect((result as Response).json()).resolves.toEqual({
      error: "Unauthorized",
    });
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("拒绝缺少所需 feature scope 的 bearer 读取", async () => {
    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-id",
      scope: new Set([OAUTH_PROFILE_SCOPE, UNRELATED_SCOPE]),
      sub: "user-from-token",
    });
    const { requireAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/workspace/todos", {
      headers: {
        authorization: "Bearer mcp-token",
      },
    });

    const result = await requireAuth(request, {
      bearerScope: { feature: "workspace.todo", action: "read" },
    });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    await expect((result as Response).json()).resolves.toEqual({
      error: "Unauthorized",
    });
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("拒绝 REST 只读 bearer 访问受保护 REST 写入", async () => {
    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-id",
      scope: expandScopeClaim(ALL_PUBLIC_READ_SCOPES),
      sub: "user-from-token",
    });
    const { requireWriteAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/workspace/todos", {
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

  it("拒绝 REST 只读 bearer 访问使用 requireAuth 的 POST 路由", async () => {
    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-id",
      scope: expandScopeClaim(ALL_PUBLIC_READ_SCOPES),
      sub: "user-from-token",
    });
    const { requireAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/workspace/todos", {
      method: "POST",
      headers: {
        authorization: "Bearer read-token",
      },
    });

    const result = await requireAuth(request, {
      bearerScope: { feature: "workspace.todo", action: "write" },
    });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    await expect((result as Response).json()).resolves.toEqual({
      error: "Unauthorized",
    });
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("拒绝缺少所需 feature scope 的 bearer 写入", async () => {
    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-id",
      scope: new Set([OAUTH_PROFILE_SCOPE, UNRELATED_SCOPE]),
      sub: "user-from-token",
    });
    const { requireWriteAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/workspace/todos", {
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

  it("在认证成功后拒绝超过 REST 写入预算的请求", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    setCloudflareRuntimeEnv({ USER_WRITE_RATE_LIMITER: { limit } });
    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-id",
      scope: expandScopeClaim(ALL_PUBLIC_WRITE_SCOPES),
      sub: "user-from-token",
    });
    const { requireAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/workspace/todos", {
      method: "POST",
      headers: { authorization: "Bearer write-token" },
    });

    const result = await requireAuth(request, {
      bearerScope: { feature: "workspace.todo", action: "write" },
    });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(429);
    expect((result as Response).headers.get("Retry-After")).toBe("60");
    await expect((result as Response).json()).resolves.toEqual({
      error: "Rate limit exceeded",
    });
    expect(limit).toHaveBeenCalledWith({
      key: JSON.stringify([
        "user-mutation:v1",
        "life.example",
        "workspace.todo:write",
        "user-from-token",
      ]),
    });
  });

  it("不为 REST 读取消耗写入预算", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    setCloudflareRuntimeEnv({ USER_WRITE_RATE_LIMITER: { limit } });
    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-id",
      scope: expandScopeClaim(ALL_PUBLIC_READ_SCOPES),
      sub: "user-from-token",
    });
    const { requireAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/workspace/todos", {
      headers: { authorization: "Bearer read-token" },
    });

    await expect(
      requireAuth(request, {
        bearerScope: { feature: "workspace.todo", action: "read" },
      }),
    ).resolves.toEqual({ userId: "user-from-token" });
    expect(limit).not.toHaveBeenCalled();
  });

  it("Cloudflare 写入限流绑定缺失时返回 503", async () => {
    setCloudflareRuntimeEnv({ ANALYTICS: { writeDataPoint: vi.fn() } });
    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-id",
      scope: expandScopeClaim(ALL_PUBLIC_WRITE_SCOPES),
      sub: "user-from-token",
    });
    const { requireAuth } = await import("@/lib/auth/api-auth");

    const result = await requireAuth(
      new Request("https://life.example/api/workspace/todos", {
        method: "POST",
        headers: { authorization: "Bearer write-token" },
      }),
      { bearerScope: { feature: "workspace.todo", action: "write" } },
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(503);
    expect((result as Response).headers.get("Retry-After")).toBe("60");
  });

  it("上传写入在用户与暂停检查后应用统一预算", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    setCloudflareRuntimeEnv({ USER_WRITE_RATE_LIMITER: { limit } });
    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-id",
      scope: expandScopeClaim(ALL_PUBLIC_WRITE_SCOPES),
      sub: "user-from-token",
    });
    getViewerAuthDataForUserIdMock.mockResolvedValue({
      user: {
        id: "user-from-token",
        name: null,
        image: null,
        isAdmin: false,
      },
      suspension: null,
    });
    const { requireWriteAuth } = await import("@/lib/auth/api-auth");

    const result = await requireWriteAuth(
      new Request("https://life.example/api/workspace/uploads", {
        method: "POST",
        headers: { authorization: "Bearer write-token" },
      }),
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(429);
    expect(getViewerAuthDataForUserIdMock).toHaveBeenCalledWith(
      "user-from-token",
    );
    expect(limit).toHaveBeenCalledWith({
      key: JSON.stringify([
        "user-mutation:v1",
        "life.example",
        "workspace.upload:write",
        "user-from-token",
      ]),
    });
  });

  it("当 bearer 令牌无效时不回退到 session cookie", async () => {
    verifyAccessTokenJwtMock.mockRejectedValue(new Error("invalid token"));
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "user-from-cookie" },
    });
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/account/profile", {
      headers: {
        authorization: "Bearer invalid-token",
        cookie: "better-auth.session_token=session-token",
      },
    });

    await expect(resolveApiUserId(request)).resolves.toBeNull();
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("小写 bearer 令牌无效时返回 401 而不回退到 session cookie", async () => {
    verifyAccessTokenJwtMock.mockRejectedValue(new Error("invalid token"));
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "user-from-cookie" },
    });
    const { requireAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/account/profile", {
      headers: {
        authorization: "bearer invalid-token",
        cookie: "better-auth.session_token=session-token",
      },
    });

    const result = await requireAuth(request, {
      bearerScope: { feature: "account.profile", action: "read" },
    });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    await expect((result as Response).json()).resolves.toEqual({
      error: "Unauthorized",
    });
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("当 bearer 令牌为空时不回退到 session cookie", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "user-from-cookie" },
    });
    const { resolveApiUserId } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/account/profile", {
      headers: {
        authorization: "Bearer ",
        cookie: "better-auth.session_token=session-token",
      },
    });

    await expect(resolveApiUserId(request)).resolves.toBeNull();
    expect(verifyAccessTokenJwtMock).not.toHaveBeenCalled();
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("从 cookie 解析仅 session 认证", async () => {
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
    expect(verifyAccessTokenJwtMock).not.toHaveBeenCalled();
  });

  it("对仅 session 认证拒绝 bearer 授权", async () => {
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
    expect(verifyAccessTokenJwtMock).not.toHaveBeenCalled();
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("当解析到的用户不存在时拒绝写入认证", async () => {
    verifyAccessTokenJwtMock.mockResolvedValue({
      clientId: "client-id",
      scope: expandScopeClaim(ALL_PUBLIC_WRITE_SCOPES),
      sub: "deleted-user",
    });
    getViewerAuthDataForUserIdMock.mockResolvedValue(null);
    const { requireWriteAuth } = await import("@/lib/auth/api-auth");
    const request = new Request("https://life.example/api/community/comments", {
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
