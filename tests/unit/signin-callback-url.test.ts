import { describe, expect, it } from "vitest";
import {
  resolveSignInCallbackUrl,
  sanitizeAuthCallbackUrl,
} from "@/lib/auth/auth-routing";
import {
  MCP_TOOLS_SCOPE,
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
} from "@/lib/oauth/constants";

describe("resolveSignInCallbackUrl", () => {
  it("prefers explicit callbackUrl", () => {
    expect(
      resolveSignInCallbackUrl({
        callbackUrl: "/settings?tab=accounts",
        client_id: "ignored",
      }),
    ).toBe("/settings?tab=accounts");
  });

  it("rejects external callbackUrl values", () => {
    expect(
      resolveSignInCallbackUrl({ callbackUrl: "https://attacker.example" }),
    ).toBe("/");
    expect(
      resolveSignInCallbackUrl({ callbackUrl: "//attacker.example" }),
    ).toBe("/");
    expect(
      resolveSignInCallbackUrl({ callbackUrl: "javascript:alert(1)" }),
    ).toBe("/");
  });

  it("sanitizes app-relative callback URLs", () => {
    expect(sanitizeAuthCallbackUrl("/settings?tab=profile#accounts")).toBe(
      "/settings?tab=profile#accounts",
    );
    expect(sanitizeAuthCallbackUrl("/\\attacker.example")).toBe("/");
    expect(sanitizeAuthCallbackUrl("/%2f%2fattacker.example")).toBe("/");
    expect(sanitizeAuthCallbackUrl("/%5cattacker.example")).toBe("/");
  });

  it("reconstructs oauth authorize continuation from raw sign-in params", () => {
    expect(
      resolveSignInCallbackUrl({
        response_type: OAUTH_CODE_RESPONSE_TYPE,
        client_id: "client-1",
        redirect_uri: "http://127.0.0.1:3000/callback",
        scope: `${OAUTH_OPENID_SCOPE} ${OAUTH_PROFILE_SCOPE} ${MCP_TOOLS_SCOPE}`,
        state: "state-1",
        code_challenge: "challenge",
        code_challenge_method: "S256",
        resource: "http://localhost:3000/api/mcp",
        exp: "1777429523",
        sig: "signature-value",
      }),
    ).toBe(
      "/oauth/authorize?response_type=code&client_id=client-1&redirect_uri=http%3A%2F%2F127.0.0.1%3A3000%2Fcallback&scope=openid+profile+mcp%3Atools&state=state-1&code_challenge=challenge&code_challenge_method=S256&resource=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fmcp&exp=1777429523&sig=signature-value",
    );
  });

  it("falls back to home when no continuation can be inferred", () => {
    expect(resolveSignInCallbackUrl({ error: "OAuthAccountNotLinked" })).toBe(
      "/",
    );
  });
});
