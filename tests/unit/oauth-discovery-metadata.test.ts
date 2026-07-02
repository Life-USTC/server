import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_OAUTH_SCOPES,
  PUBLIC_REST_SCOPES,
} from "@/lib/oauth/scope-registry";

const { authServerMetadataHandlerMock, openIdMetadataHandlerMock } = vi.hoisted(
  () => ({
    authServerMetadataHandlerMock: vi.fn(),
    openIdMetadataHandlerMock: vi.fn(),
  }),
);

vi.mock("@better-auth/oauth-provider", () => ({
  oauthProviderAuthServerMetadata: () => authServerMetadataHandlerMock,
  oauthProviderOpenIdConfigMetadata: () => openIdMetadataHandlerMock,
}));

vi.mock("@/lib/auth/core", () => ({
  betterAuthInstance: {
    api: {
      getOAuthServerConfig: vi.fn(),
      getOpenIdConfig: vi.fn(),
    },
  },
}));

vi.mock("@/lib/mcp/urls", () => ({
  getMcpServerUrl: () => new URL("https://life.example/api/mcp"),
  getOAuthAuthorizationServerMetadataUrl: () =>
    new URL(
      "https://life.example/.well-known/oauth-authorization-server/api/auth",
    ),
  getOAuthIssuerUrl: () => new URL("https://life.example/api/auth"),
  getOAuthOpenIdConfigurationUrl: () =>
    new URL("https://life.example/api/auth/.well-known/openid-configuration"),
  getOAuthProtectedResourceMetadataUrl: () =>
    new URL(
      "https://life.example/.well-known/oauth-protected-resource/api/mcp",
    ),
}));

describe("OAuth 发现元数据路由", () => {
  afterEach(() => {
    authServerMetadataHandlerMock.mockReset();
    openIdMetadataHandlerMock.mockReset();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("为重定向添加发现 CORS 头且保留 Location", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://unit:unit@127.0.0.1:5432/unit");
    vi.stubEnv("AUTH_SECRET", "unit-test-secret");

    const { createDiscoveryRedirectRoute } = await import(
      "@/lib/oauth/discovery-metadata"
    );
    const route = createDiscoveryRedirectRoute(
      () =>
        new URL(
          "https://life.example/.well-known/oauth-authorization-server/api/auth",
        ),
    );

    const response = await route.GET(
      new Request(
        "https://life.example/.well-known/oauth-authorization-server",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://life.example/.well-known/oauth-authorization-server/api/auth",
    );
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET, OPTIONS",
    );
  });

  it("不在授权服务器元数据中宣告 client_credentials", async () => {
    authServerMetadataHandlerMock.mockResolvedValue(
      Response.json({
        issuer: "https://life.example/api/auth",
        grant_types_supported: [
          "authorization_code",
          "refresh_token",
          "client_credentials",
        ],
      }),
    );
    const { getAuthServerMetadataResponse } = await import(
      "@/lib/oauth/discovery-metadata"
    );

    const response = await getAuthServerMetadataResponse(
      new Request(
        "https://life.example/.well-known/oauth-authorization-server/api/auth",
      ),
    );
    const body = await response.json();

    expect(body.grant_types_supported).toEqual([
      "authorization_code",
      "refresh_token",
      "urn:ietf:params:oauth:grant-type:device_code",
    ]);
    expect(body.grant_types_supported).not.toContain("client_credentials");
    expect(body.device_authorization_endpoint).toBe(
      "https://life.example/api/auth/oauth2/device-authorization",
    );
    expect(body.scopes_supported).toEqual([...PUBLIC_OAUTH_SCOPES]);
    expect(body.scopes_supported).not.toContain("admin:read");
    expect(body.scopes_supported).not.toContain("admin:write");
  });

  it("不在 OpenID 元数据中宣告 client_credentials", async () => {
    openIdMetadataHandlerMock.mockResolvedValue(
      Response.json({
        issuer: "https://life.example/api/auth",
        grant_types_supported: [
          "authorization_code",
          "refresh_token",
          "client_credentials",
        ],
      }),
    );
    const { getOpenIdMetadataResponse } = await import(
      "@/lib/oauth/discovery-metadata"
    );

    const response = await getOpenIdMetadataResponse(
      new Request(
        "https://life.example/api/auth/.well-known/openid-configuration",
      ),
    );
    const body = await response.json();

    expect(body.grant_types_supported).toEqual([
      "authorization_code",
      "refresh_token",
      "urn:ietf:params:oauth:grant-type:device_code",
    ]);
    expect(body.grant_types_supported).not.toContain("client_credentials");
    expect(body.scopes_supported).toEqual([...PUBLIC_OAUTH_SCOPES]);
    expect(body.scopes_supported).not.toContain("admin:read");
    expect(body.scopes_supported).not.toContain("admin:write");
  });

  it("MCP protected-resource 元数据只宣告公开非 admin feature scope", async () => {
    const { createOAuthDiscoveryRoute } = await import(
      "@/lib/oauth/discovery-routes"
    );
    const route = createOAuthDiscoveryRoute("protectedResourceMetadata");

    const response = await route.GET({
      request: new Request(
        "https://life.example/.well-known/oauth-protected-resource/api/mcp",
      ),
    } as never);
    const body = await response.json();

    expect(body.resource).toBe("https://life.example/api/mcp");
    expect(body.authorization_servers).toEqual([
      "https://life.example/api/auth",
    ]);
    expect(body.scopes_supported).toEqual([...PUBLIC_REST_SCOPES]);
    expect(body.scopes_supported).not.toContain("admin:read");
    expect(body.scopes_supported).not.toContain("admin:write");
    expect(body.scopes_supported).not.toContain("mcp:tools");
  });
});
