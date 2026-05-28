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
} from "@/lib/oauth/constants";

describe("oauth constants", () => {
  it("detects supported OAuth client authentication methods", () => {
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

  it("keeps provider-advertised OAuth scopes in stable order", () => {
    expect(OAUTH_PROVIDER_SCOPES).toEqual([
      OAUTH_OPENID_SCOPE,
      OAUTH_PROFILE_SCOPE,
      OAUTH_EMAIL_SCOPE,
      OAUTH_OFFLINE_ACCESS_SCOPE,
      MCP_TOOLS_SCOPE,
    ]);
  });
});
