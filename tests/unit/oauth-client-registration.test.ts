import { describe, expect, it } from "vitest";
import {
  resolveOAuthClientGrantTypes,
  resolveOAuthClientScopes,
} from "@/lib/oauth/client-registration";
import {
  MCP_TOOLS_SCOPE,
  OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
  OAUTH_OFFLINE_ACCESS_SCOPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
  OAUTH_REFRESH_TOKEN_GRANT_TYPE,
  OAUTH_REST_READ_SCOPE,
  OAUTH_REST_WRITE_SCOPE,
} from "@/lib/oauth/constants";

describe("resolveOAuthClientScopes", () => {
  it("未请求 scope 时使用默认 OAuth profile scope", () => {
    expect(resolveOAuthClientScopes()).toEqual({
      scopes: [OAUTH_OPENID_SCOPE, OAUTH_PROFILE_SCOPE],
    });
  });

  it("去重请求的 scope 并保留请求顺序", () => {
    expect(
      resolveOAuthClientScopes([
        OAUTH_PROFILE_SCOPE,
        MCP_TOOLS_SCOPE,
        OAUTH_PROFILE_SCOPE,
      ]),
    ).toEqual({
      scopes: [OAUTH_PROFILE_SCOPE, MCP_TOOLS_SCOPE],
    });
  });

  it("接受空格分隔的请求 scope", () => {
    expect(
      resolveOAuthClientScopes(
        `${OAUTH_OPENID_SCOPE} ${MCP_TOOLS_SCOPE} ${OAUTH_OFFLINE_ACCESS_SCOPE} ${OAUTH_REST_READ_SCOPE} ${OAUTH_REST_WRITE_SCOPE}`,
      ),
    ).toEqual({
      scopes: [
        OAUTH_OPENID_SCOPE,
        MCP_TOOLS_SCOPE,
        OAUTH_OFFLINE_ACCESS_SCOPE,
        OAUTH_REST_READ_SCOPE,
        OAUTH_REST_WRITE_SCOPE,
      ],
    });
  });

  it("拒绝不支持的请求 scope", () => {
    expect(resolveOAuthClientScopes([OAUTH_OPENID_SCOPE, "email"])).toEqual({
      error: "Unsupported scopes requested: email",
    });
  });

  it("除非请求 offline access，否则使用 authorization-code 授权类型", () => {
    expect(
      resolveOAuthClientGrantTypes([OAUTH_OPENID_SCOPE, OAUTH_PROFILE_SCOPE]),
    ).toEqual([OAUTH_AUTHORIZATION_CODE_GRANT_TYPE]);

    expect(
      resolveOAuthClientGrantTypes([
        OAUTH_OPENID_SCOPE,
        OAUTH_OFFLINE_ACCESS_SCOPE,
      ]),
    ).toEqual([
      OAUTH_AUTHORIZATION_CODE_GRANT_TYPE,
      OAUTH_REFRESH_TOKEN_GRANT_TYPE,
    ]);
  });
});
