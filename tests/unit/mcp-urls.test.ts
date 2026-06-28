import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCanonicalOAuthIssuer,
  getOAuthAuthorizationServerMetadataUrl,
  getOAuthIssuerUrl,
  getOAuthMcpAudienceUrls,
  getOAuthOpenIdConfigurationUrl,
  getOAuthProtectedResourceMetadataUrl,
  getOAuthProviderValidAudiences,
  getOAuthRestAudienceUrls,
} from "@/lib/mcp/urls";
import {
  getBetterAuthBaseUrl,
  getCanonicalOrigin,
  getPublicOrigin,
} from "@/lib/site-url";

describe("MCP URL 辅助函数", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("public 链接使用 APP_PUBLIC_ORIGIN", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://preview.example.com");
    expect(getPublicOrigin()).toBe("https://preview.example.com");
    expect(getBetterAuthBaseUrl()).toBe("https://preview.example.com/api/auth");
  });

  it("APP_PUBLIC_ORIGIN 未设置时回退到固定的本地 origin", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "");
    expect(getPublicOrigin()).toBe("http://localhost:3000");
  });

  it("将 public origin 作为 canonical origin", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://life-ustc.tiankaima.dev");
    expect(getCanonicalOrigin()).toBe("https://life-ustc.tiankaima.dev");
  });

  it("canonical origin 优先使用 APP_CANONICAL_ORIGIN", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://preview.example.com");
    vi.stubEnv("APP_CANONICAL_ORIGIN", "https://life.example.com");

    expect(getCanonicalOrigin()).toBe("https://life.example.com");
  });

  it("从基于路径的 issuer/resource 标识符派生规范 OAuth 与 MCP 元数据 URL", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://life.example.com");
    expect(getCanonicalOAuthIssuer()).toBe("https://life.example.com/api/auth");
    expect(getOAuthRestAudienceUrls()).toEqual([
      "https://life.example.com/api/auth",
    ]);
    expect(getOAuthProviderValidAudiences()).toEqual([
      "https://life.example.com/api/auth",
      "https://life.example.com/api/mcp",
    ]);
    expect(getOAuthMcpAudienceUrls()).toEqual([
      "https://life.example.com/api/mcp",
      "https://life.example.com/api/auth/oauth2/userinfo",
      "https://life.example.com/api/auth",
    ]);
    expect(getOAuthIssuerUrl().toString()).toBe(
      "https://life.example.com/api/auth",
    );
    expect(getOAuthAuthorizationServerMetadataUrl().toString()).toBe(
      "https://life.example.com/.well-known/oauth-authorization-server/api/auth",
    );
    expect(getOAuthOpenIdConfigurationUrl().toString()).toBe(
      "https://life.example.com/api/auth/.well-known/openid-configuration",
    );
    expect(getOAuthProtectedResourceMetadataUrl().toString()).toBe(
      "https://life.example.com/.well-known/oauth-protected-resource/api/mcp",
    );
  });

  it("自定义本地端口包含 loopback 兄弟 MCP audience", () => {
    vi.stubEnv("APP_PUBLIC_ORIGIN", "http://localhost:3010");

    expect(getOAuthProviderValidAudiences()).toEqual([
      "http://localhost:3010/api/auth",
      "http://127.0.0.1:3010/api/auth",
      "http://localhost:3010/api/mcp",
      "http://127.0.0.1:3010/api/mcp",
    ]);
    expect(getOAuthMcpAudienceUrls()).toEqual([
      "http://localhost:3010/api/mcp",
      "http://127.0.0.1:3010/api/mcp",
      "http://localhost:3010/api/auth/oauth2/userinfo",
      "http://localhost:3010/api/auth",
    ]);
  });
});
