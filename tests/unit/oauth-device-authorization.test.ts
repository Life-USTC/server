import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";

const TODO_READ_SCOPE = "workspace.todo:read";

const { createDeviceAuthorizationGrantMock, findUniqueMock, logAppEventMock } =
  vi.hoisted(() => ({
    createDeviceAuthorizationGrantMock: vi.fn(),
    findUniqueMock: vi.fn(),
    logAppEventMock: vi.fn(),
  }));

vi.mock("@/features/oauth/server/device-grant-policy.server", () => ({
  createDeviceAuthorizationGrant: createDeviceAuthorizationGrantMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthClient: {
      findUnique: findUniqueMock,
    },
  },
}));

vi.mock("@/lib/log/oauth-debug", () => ({
  logOAuthDebug: vi.fn(),
}));

vi.mock("@/lib/log/app-logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/log/app-logger")>()),
  logAppEvent: logAppEventMock,
}));

vi.mock("@/lib/mcp/urls", () => ({
  getOAuthMcpResourceUrl: () => "https://life.example/api/mcp",
  getOAuthProviderValidAudiences: () => [
    "https://life.example/api/auth",
    "https://life.example/api/mcp",
  ],
}));

function publicDeviceClient(overrides: Record<string, unknown> = {}) {
  return {
    clientId: "client-1",
    disabled: false,
    grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
    name: "Client",
    public: true,
    scopes: [OAUTH_OPENID_SCOPE, OAUTH_PROFILE_SCOPE, TODO_READ_SCOPE],
    tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
    type: "public",
    ...overrides,
  };
}

describe("设备授权", () => {
  beforeEach(() => {
    createDeviceAuthorizationGrantMock.mockReset();
    findUniqueMock.mockReset();
    logAppEventMock.mockReset();
  });

  it("拒绝未注册设备授权许可的客户端", async () => {
    findUniqueMock.mockResolvedValue(
      publicDeviceClient({ grantTypes: ["authorization_code"] }),
    );
    const { resolveDeviceAuthorizationClient } = await import(
      "@/features/oauth/server/device-authorization-policy.server"
    );

    const result = await resolveDeviceAuthorizationClient({
      clientId: "client-1",
      scope: OAUTH_OPENID_SCOPE,
      resourceEntries: [],
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) {
      throw new Error("Expected device authorization policy error");
    }
    expect(result.error.status).toBe(400);
    expect(result.error).toMatchObject({
      error: "unauthorized_client",
    });
  });

  it("拒绝机密客户端使用设备授权", async () => {
    findUniqueMock.mockResolvedValue(
      publicDeviceClient({
        public: false,
        tokenEndpointAuthMethod: "client_secret_basic",
        type: "web",
      }),
    );
    const { resolveDeviceAuthorizationClient } = await import(
      "@/features/oauth/server/device-authorization-policy.server"
    );

    const result = await resolveDeviceAuthorizationClient({
      clientId: "client-1",
      scope: OAUTH_OPENID_SCOPE,
      resourceEntries: [],
    });

    expect("error" in result).toBe(true);
    if (!("error" in result)) {
      throw new Error("Expected device authorization policy error");
    }
    expect(result.error.status).toBe(400);
    expect(result.error).toMatchObject({
      error: "unauthorized_client",
    });
  });

  it("资源选择不再由已移除的 transport scope 推断", async () => {
    const { resolveRequestedDeviceResources } = await import(
      "@/features/oauth/server/device-authorization-policy.server"
    );

    const result = resolveRequestedDeviceResources(
      ["https://life.example/api/auth"],
      [OAUTH_OPENID_SCOPE, TODO_READ_SCOPE],
    );

    expect(result).toEqual({
      resources: ["https://life.example/api/auth"],
    });
  });

  it("将省略的设备作用域默认为低风险客户端默认值", async () => {
    findUniqueMock.mockResolvedValue(publicDeviceClient());
    const { resolveDeviceAuthorizationClient } = await import(
      "@/features/oauth/server/device-authorization-policy.server"
    );

    const result = await resolveDeviceAuthorizationClient({
      clientId: "client-1",
      scope: null,
      resourceEntries: [],
    });

    expect(result).toMatchObject({
      requestedResources: [],
      requestedScopes: [...DEFAULT_OAUTH_CLIENT_SCOPES],
    });
  });

  it("接受并规范化有效的 REST 与 MCP 资源", async () => {
    findUniqueMock.mockResolvedValue(publicDeviceClient());
    const { resolveDeviceAuthorizationClient } = await import(
      "@/features/oauth/server/device-authorization-policy.server"
    );

    const result = await resolveDeviceAuthorizationClient({
      clientId: "client-1",
      scope: `${OAUTH_OPENID_SCOPE} ${TODO_READ_SCOPE}`,
      resourceEntries: [
        "https://life.example:443/api/auth",
        "https://life.example/api/mcp",
      ],
    });

    expect(result).toMatchObject({
      requestedResources: [
        "https://life.example/api/auth",
        "https://life.example/api/mcp",
      ],
      requestedScopes: [OAUTH_OPENID_SCOPE, TODO_READ_SCOPE],
    });
  });

  it("始终记录设备授权 grant 创建失败", async () => {
    findUniqueMock.mockResolvedValue(publicDeviceClient());
    createDeviceAuthorizationGrantMock.mockRejectedValue(
      new TypeError("database unavailable"),
    );
    const { deviceAuthorizationPostRoute } = await import(
      "@/lib/api/routes/auth-device-authorization"
    );

    const response = await deviceAuthorizationPostRoute(
      new Request("https://life.example/api/auth/oauth2/device-authorization", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: "client-1",
          scope: OAUTH_OPENID_SCOPE,
        }),
      }),
    );

    expect(response.status).toBe(500);
    expect(logAppEventMock).toHaveBeenCalledWith(
      "error",
      "OAuth device authorization grant creation failed",
      {
        event: "oauth.device-authorization.failed",
        phase: "create-grant",
      },
      expect.any(TypeError),
    );
  });
});
