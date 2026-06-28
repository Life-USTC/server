import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OAUTH_CLIENT_SCOPES,
  MCP_TOOLS_SCOPE,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";

const findUniqueMock = vi.fn();

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
    scopes: [OAUTH_OPENID_SCOPE, OAUTH_PROFILE_SCOPE, MCP_TOOLS_SCOPE],
    tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
    type: "public",
    ...overrides,
  };
}

describe("设备授权", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
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

  it("请求 mcp:tools 作用域时要求 MCP 资源", async () => {
    const { resolveRequestedDeviceResources } = await import(
      "@/features/oauth/server/device-authorization-policy.server"
    );

    const result = resolveRequestedDeviceResources(
      ["https://life.example/api/auth"],
      [OAUTH_OPENID_SCOPE, MCP_TOOLS_SCOPE],
    );

    if ("error" in result) {
      expect(result.error).toMatchObject({
        error: "invalid_target",
        status: 400,
      });
      return;
    }
    throw new Error("Expected device resource policy error");
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
      scope: `${OAUTH_OPENID_SCOPE} ${MCP_TOOLS_SCOPE}`,
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
      requestedScopes: [OAUTH_OPENID_SCOPE, MCP_TOOLS_SCOPE],
    });
  });
});
