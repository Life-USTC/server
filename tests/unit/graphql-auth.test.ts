import { GraphQLError } from "graphql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { restReadScope, restWriteScope } from "@/lib/oauth/constants";

const getSessionFromHeadersMock = vi.fn();
const verifyAccessTokenJwtMock = vi.fn();

vi.mock("@/lib/auth/core", () => ({
  authApi: { getJwks: vi.fn().mockResolvedValue({ keys: [] }) },
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

vi.mock("@/lib/auth/jwt-verification", () => ({
  verifyAccessTokenJwt: verifyAccessTokenJwtMock,
}));

function request(headers?: HeadersInit) {
  return new Request("https://life.example/api/graphql", { headers });
}

describe("GraphQL principal", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://life.example");
    getSessionFromHeadersMock.mockReset();
    verifyAccessTokenJwtMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("无认证信号时返回 anonymous", async () => {
    const { resolveGraphqlPrincipal } = await import("@/lib/graphql/auth");

    await expect(resolveGraphqlPrincipal(request())).resolves.toEqual({
      kind: "anonymous",
    });
    expect(verifyAccessTokenJwtMock).not.toHaveBeenCalled();
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("Bearer 只使用 GraphQL audience 并保留 client/resource", async () => {
    verifyAccessTokenJwtMock.mockResolvedValue({
      aud: "https://life.example/api/graphql",
      clientId: "client-1",
      scope: new Set([restReadScope("todo")]),
      sub: "user-1",
    });
    const { resolveGraphqlPrincipal } = await import("@/lib/graphql/auth");

    await expect(
      resolveGraphqlPrincipal(
        request({ authorization: "Bearer access-token" }),
      ),
    ).resolves.toEqual({
      kind: "oauth",
      userId: "user-1",
      scopes: new Set([restReadScope("todo")]),
      resource: "https://life.example/api/graphql",
      clientId: "client-1",
    });
    expect(verifyAccessTokenJwtMock).toHaveBeenCalledWith(
      "access-token",
      expect.objectContaining({
        audience: ["https://life.example/api/graphql"],
        issuer: ["https://life.example/api/auth"],
        jwksUrl: "https://life.example/api/auth/jwks",
      }),
    );
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it.each([
    "https://life.example/api/mcp",
    "https://life.example/api/auth",
  ])("拒绝 %s audience 且不回退 Session", async (aud) => {
    verifyAccessTokenJwtMock.mockResolvedValue({
      aud,
      scope: new Set([restReadScope("todo")]),
      sub: "user-1",
    });
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "session-user" },
    });
    const { resolveGraphqlPrincipal } = await import("@/lib/graphql/auth");

    await expect(
      resolveGraphqlPrincipal(
        request({
          authorization: "Bearer access-token",
          cookie: "better-auth.session_token=session-token",
          origin: "https://life.example",
        }),
      ),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("无效 Bearer 不回退 Session", async () => {
    verifyAccessTokenJwtMock.mockRejectedValue(new Error("invalid token"));
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "session-user" },
    });
    const { resolveGraphqlPrincipal } = await import("@/lib/graphql/auth");

    await expect(
      resolveGraphqlPrincipal(
        request({
          authorization: "Bearer invalid-token",
          cookie: "better-auth.session_token=session-token",
          origin: "https://life.example",
        }),
      ),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("空 Bearer 不回退 Session", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "session-user" },
    });
    const { resolveGraphqlPrincipal } = await import("@/lib/graphql/auth");

    await expect(
      resolveGraphqlPrincipal(
        request({
          authorization: "Bearer",
          cookie: "better-auth.session_token=session-token",
          origin: "https://life.example",
        }),
      ),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });
    expect(verifyAccessTokenJwtMock).not.toHaveBeenCalled();
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("可信 Origin 的 Session cookie 解析为 session principal", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "session-user" },
    });
    const { resolveGraphqlPrincipal } = await import("@/lib/graphql/auth");
    const incoming = request({
      cookie: "better-auth.session_token=session-token",
      origin: "https://life.example",
    });

    await expect(resolveGraphqlPrincipal(incoming)).resolves.toEqual({
      kind: "session",
      userId: "session-user",
    });
    expect(getSessionFromHeadersMock).toHaveBeenCalledTimes(1);
    expect(getSessionFromHeadersMock).toHaveBeenCalledWith(incoming.headers);
  });

  it.each([
    undefined,
    "https://evil.example",
  ])("Session cookie 拒绝缺失或不可信 Origin：%s", async (origin) => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "session-user" },
    });
    const { resolveGraphqlPrincipal } = await import("@/lib/graphql/auth");

    await expect(
      resolveGraphqlPrincipal(
        request({
          cookie: "better-auth.session_token=session-token",
          ...(origin ? { origin } : {}),
        }),
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });

  it("已过期 Session cookie 在可信 Origin 下回退 anonymous", async () => {
    getSessionFromHeadersMock.mockResolvedValue(null);
    const { resolveGraphqlPrincipal } = await import("@/lib/graphql/auth");

    await expect(
      resolveGraphqlPrincipal(
        request({
          cookie: "better-auth.session_token=expired",
          origin: "https://life.example",
        }),
      ),
    ).resolves.toEqual({ kind: "anonymous" });
  });
});

describe("GraphQL feature scope gates", () => {
  it("Session 复用业务服务权限而不要求 OAuth scope", async () => {
    const { requireGraphqlScope } = await import("@/lib/graphql/auth");

    expect(
      requireGraphqlScope(
        { kind: "session", userId: "user-1" },
        { feature: "todo", action: "read" },
      ),
    ).toMatchObject({ kind: "session", userId: "user-1" });
  });

  it("OAuth read 接受 matching read 或 write scope", async () => {
    const { requireGraphqlScope } = await import("@/lib/graphql/auth");

    for (const scope of [restReadScope("todo"), restWriteScope("todo")]) {
      expect(
        requireGraphqlScope(
          {
            kind: "oauth",
            userId: "user-1",
            scopes: new Set([scope]),
            resource: "https://life.example/api/graphql",
          },
          { feature: "todo", action: "read" },
        ),
      ).toMatchObject({ kind: "oauth", userId: "user-1" });
    }
  });

  it("OAuth 多字段 scope union 缺任一 feature 即拒绝", async () => {
    const { requireGraphqlScopes } = await import("@/lib/graphql/auth");

    expect(() =>
      requireGraphqlScopes(
        {
          kind: "oauth",
          userId: "user-1",
          scopes: new Set([restReadScope("todo")]),
          resource: "https://life.example/api/graphql",
        },
        [
          { feature: "todo", action: "read" },
          { feature: "subscription", action: "read" },
        ],
      ),
    ).toThrow(
      expect.objectContaining({
        code: "FORBIDDEN",
        requiredScopes: [restReadScope("subscription")],
        status: 403,
      }),
    );
  });

  it("OAuth 无 feature scope 时拒绝私有字段", async () => {
    const { requireGraphqlScope } = await import("@/lib/graphql/auth");

    expect(() =>
      requireGraphqlScope(
        {
          kind: "oauth",
          userId: "user-1",
          scopes: new Set(),
          resource: "https://life.example/api/graphql",
        },
        { feature: "me", action: "read" },
      ),
    ).toThrow(
      expect.objectContaining({
        code: "FORBIDDEN",
        requiredScopes: [restReadScope("me")],
        status: 403,
      }),
    );
  });

  it.each([
    [
      "anonymous",
      { kind: "anonymous" } as const,
      { feature: "me", action: "read" } as const,
      "UNAUTHENTICATED",
      401,
      [],
    ],
    [
      "missing scope",
      {
        kind: "oauth",
        userId: "user-1",
        scopes: new Set<string>(),
        resource: "https://life.example/api/graphql",
      } as const,
      { feature: "todo", action: "read" } as const,
      "FORBIDDEN",
      403,
      [restReadScope("todo")],
    ],
  ])("%s 错误是不会被 masking 吞掉的安全 GraphQLError", async (_case, principal, requirement, code, status, requiredScopes) => {
    const { requireGraphqlScope } = await import("@/lib/graphql/auth");

    let thrown: unknown;
    try {
      requireGraphqlScope(principal, requirement);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(GraphQLError);
    expect(thrown).toMatchObject({
      code,
      status,
      requiredScopes,
      extensions: {
        code,
        requiredScopes,
        http: { status },
      },
    });
  });

  it("anonymous 访问私有字段返回 UNAUTHENTICATED", async () => {
    const { requireGraphqlScope } = await import("@/lib/graphql/auth");

    expect(() =>
      requireGraphqlScope(
        { kind: "anonymous" },
        { feature: "me", action: "read" },
      ),
    ).toThrow(
      expect.objectContaining({ code: "UNAUTHENTICATED", status: 401 }),
    );
  });

  it("context 只解析一次 principal 并供多个字段复用", async () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://life.example");
    getSessionFromHeadersMock.mockReset();
    verifyAccessTokenJwtMock.mockReset();
    verifyAccessTokenJwtMock.mockResolvedValue({
      aud: "https://life.example/api/graphql",
      scope: new Set([restReadScope("todo"), restReadScope("subscription")]),
      sub: "user-1",
    });
    const { createGraphqlAuthContext } = await import("@/lib/graphql/context");
    const { requireGraphqlScope } = await import("@/lib/graphql/auth");

    const context = await createGraphqlAuthContext(
      request({ authorization: "Bearer access-token" }),
    );
    requireGraphqlScope(context.principal, {
      feature: "todo",
      action: "read",
    });
    requireGraphqlScope(context.principal, {
      feature: "subscription",
      action: "read",
    });

    expect(verifyAccessTokenJwtMock).toHaveBeenCalledTimes(1);
    expect(getSessionFromHeadersMock).not.toHaveBeenCalled();
  });
});
