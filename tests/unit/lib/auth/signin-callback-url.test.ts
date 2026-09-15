import { describe, expect, it } from "vitest";
import {
  resolveSignInCallbackUrl,
  sanitizeAuthCallbackUrl,
} from "@/lib/auth/auth-routing";
import {
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_OPENID_SCOPE,
  OAUTH_PROFILE_SCOPE,
} from "@/lib/oauth/constants";

const TODO_READ_SCOPE = "workspace.todo:read";

describe("resolveSignInCallbackUrl", () => {
  it("优先使用显式 callbackUrl", () => {
    expect(
      resolveSignInCallbackUrl({
        callbackUrl: "/account/settings?tab=accounts",
        client_id: "ignored",
      }),
    ).toBe("/account/settings?tab=accounts");
  });

  it("拒绝外部 callbackUrl 值", () => {
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

  it("清理应用内相对回调 URL", () => {
    expect(
      sanitizeAuthCallbackUrl("/account/settings?tab=profile#accounts"),
    ).toBe("/account/settings?tab=profile#accounts");
    expect(sanitizeAuthCallbackUrl("/\\attacker.example")).toBe("/");
    expect(sanitizeAuthCallbackUrl("/%2f%2fattacker.example")).toBe("/");
    expect(sanitizeAuthCallbackUrl("/%5cattacker.example")).toBe("/");
  });

  it("根据原始登录参数重建 OAuth 授权继续请求", () => {
    expect(
      resolveSignInCallbackUrl({
        response_type: OAUTH_CODE_RESPONSE_TYPE,
        client_id: "client-1",
        redirect_uri: "http://127.0.0.1:3000/callback",
        scope: `${OAUTH_OPENID_SCOPE} ${OAUTH_PROFILE_SCOPE} ${TODO_READ_SCOPE}`,
        state: "state-1",
        code_challenge: "challenge",
        code_challenge_method: "S256",
        resource: "http://localhost:3000/api/mcp",
        exp: "1777429523",
        sig: "signature-value",
      }),
    ).toBe(
      "/oauth/authorize?response_type=code&client_id=client-1&redirect_uri=http%3A%2F%2F127.0.0.1%3A3000%2Fcallback&scope=openid+profile+workspace.todo%3Aread&state=state-1&code_challenge=challenge&code_challenge_method=S256&resource=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fmcp&exp=1777429523&sig=signature-value",
    );
  });

  it("无法推断继续请求时回退到首页", () => {
    expect(resolveSignInCallbackUrl({ error: "OAuthAccountNotLinked" })).toBe(
      "/",
    );
  });
});
