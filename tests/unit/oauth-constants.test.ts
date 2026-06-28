import { describe, expect, it } from "vitest";
import {
  isSupportedOAuthClientAuthMethod,
  MCP_TOOLS_SCOPE,
  OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
  OAUTH_CLIENT_SECRET_POST_AUTH_METHOD,
  OAUTH_EMAIL_SCOPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_PROVIDER_SCOPES,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  OAUTH_REST_READ_SCOPE,
  OAUTH_REST_WRITE_SCOPE,
} from "@/lib/oauth/constants";

describe("oauth 常量", () => {
  it("检测支持的 OAuth 客户端认证方式", () => {
    expect(
      isSupportedOAuthClientAuthMethod(OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD),
    ).toBe(true);
    expect(
      isSupportedOAuthClientAuthMethod(OAUTH_CLIENT_SECRET_POST_AUTH_METHOD),
    ).toBe(true);
    expect(
      isSupportedOAuthClientAuthMethod(OAUTH_PUBLIC_CLIENT_AUTH_METHOD),
    ).toBe(true);
    expect(isSupportedOAuthClientAuthMethod("client_secret_jwt")).toBe(false);
  });

  it("保持 provider 公布的 OAuth scope 顺序稳定", () => {
    expect(OAUTH_PROVIDER_SCOPES).toEqual([
      OAUTH_OPENID_SCOPE,
      OAUTH_PROFILE_SCOPE,
      OAUTH_EMAIL_SCOPE,
      OAUTH_OFFLINE_ACCESS_SCOPE,
      OAUTH_REST_READ_SCOPE,
      OAUTH_REST_WRITE_SCOPE,
      MCP_TOOLS_SCOPE,
    ]);
  });
});
