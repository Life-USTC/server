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

describe("device authorization", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it("rejects clients that are not registered for the device grant", async () => {
    findUniqueMock.mockResolvedValue(
      publicDeviceClient({ grantTypes: ["authorization_code"] }),
    );
    const { resolveDeviceAuthorizationClient } = await import(
      "@/lib/api/routes/auth-device-client-resolution"
    );

    const result = await resolveDeviceAuthorizationClient(
      new Request("https://life.example/api/auth/oauth2/device-authorization"),
      "client-1",
      OAUTH_OPENID_SCOPE,
      [],
    );

    expect("response" in result).toBe(true);
    if (!("response" in result) || !result.response) {
      throw new Error("Expected device authorization error response");
    }
    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toMatchObject({
      error: "unauthorized_client",
    });
  });

  it("rejects confidential clients for device authorization", async () => {
    findUniqueMock.mockResolvedValue(
      publicDeviceClient({
        public: false,
        tokenEndpointAuthMethod: "client_secret_basic",
        type: "web",
      }),
    );
    const { resolveDeviceAuthorizationClient } = await import(
      "@/lib/api/routes/auth-device-client-resolution"
    );

    const result = await resolveDeviceAuthorizationClient(
      new Request("https://life.example/api/auth/oauth2/device-authorization"),
      "client-1",
      OAUTH_OPENID_SCOPE,
      [],
    );

    expect("response" in result).toBe(true);
    if (!("response" in result) || !result.response) {
      throw new Error("Expected device authorization error response");
    }
    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toMatchObject({
      error: "unauthorized_client",
    });
  });

  it("requires the MCP resource when mcp:tools scope is requested", async () => {
    const { resolveRequestedDeviceResources } = await import(
      "@/lib/api/routes/auth-device-authorization-helpers"
    );

    const result = resolveRequestedDeviceResources(
      ["https://life.example/api/auth"],
      [OAUTH_OPENID_SCOPE, MCP_TOOLS_SCOPE],
    );

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(400);
      await expect(result.error.json()).resolves.toMatchObject({
        error: "invalid_target",
      });
    }
  });

  it("defaults omitted device scopes to low-risk client defaults", async () => {
    findUniqueMock.mockResolvedValue(publicDeviceClient());
    const { resolveDeviceAuthorizationClient } = await import(
      "@/lib/api/routes/auth-device-client-resolution"
    );

    const result = await resolveDeviceAuthorizationClient(
      new Request("https://life.example/api/auth/oauth2/device-authorization"),
      "client-1",
      null,
      [],
    );

    expect(result).toMatchObject({
      requestedResources: [],
      requestedScopes: [...DEFAULT_OAUTH_CLIENT_SCOPES],
    });
  });

  it("accepts and canonicalizes valid REST and MCP resources", async () => {
    findUniqueMock.mockResolvedValue(publicDeviceClient());
    const { resolveDeviceAuthorizationClient } = await import(
      "@/lib/api/routes/auth-device-client-resolution"
    );

    const result = await resolveDeviceAuthorizationClient(
      new Request("https://life.example/api/auth/oauth2/device-authorization"),
      "client-1",
      `${OAUTH_OPENID_SCOPE} ${MCP_TOOLS_SCOPE}`,
      ["https://life.example:443/api/auth", "https://life.example/api/mcp"],
    );

    expect(result).toMatchObject({
      requestedResources: [
        "https://life.example/api/auth",
        "https://life.example/api/mcp",
      ],
      requestedScopes: [OAUTH_OPENID_SCOPE, MCP_TOOLS_SCOPE],
    });
  });
});
