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
} from "@/lib/oauth/constants";

describe("resolveOAuthClientScopes", () => {
  it("uses the default OAuth profile scopes when none are requested", () => {
    expect(resolveOAuthClientScopes()).toEqual({
      scopes: [OAUTH_OPENID_SCOPE, OAUTH_PROFILE_SCOPE],
    });
  });

  it("deduplicates requested scopes while preserving request order", () => {
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

  it("accepts space-delimited requested scopes", () => {
    expect(
      resolveOAuthClientScopes(
        `${OAUTH_OPENID_SCOPE} ${MCP_TOOLS_SCOPE} ${OAUTH_OFFLINE_ACCESS_SCOPE}`,
      ),
    ).toEqual({
      scopes: [OAUTH_OPENID_SCOPE, MCP_TOOLS_SCOPE, OAUTH_OFFLINE_ACCESS_SCOPE],
    });
  });

  it("rejects unsupported requested scopes", () => {
    expect(resolveOAuthClientScopes([OAUTH_OPENID_SCOPE, "email"])).toEqual({
      error: "Unsupported scopes requested: email",
    });
  });

  it("uses authorization-code grants unless offline access is requested", () => {
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
