import { describe, expect, it } from "vitest";
import { buildUstcOidcProviderEndpoints } from "@/lib/auth/ustc-oidc-endpoints";

describe("USTC OIDC provider endpoints", () => {
  it("builds explicit passport endpoints without discovery", () => {
    expect(
      buildUstcOidcProviderEndpoints(
        "https://sso-proxy.lug.ustc.edu.cn/auth/oauth2",
      ),
    ).toEqual({
      authorizationUrl:
        "https://sso-proxy.lug.ustc.edu.cn/auth/oauth2/authorize/",
      tokenUrl: "https://sso-proxy.lug.ustc.edu.cn/auth/oauth2/token/",
      userInfoUrl: "https://sso-proxy.lug.ustc.edu.cn/auth/oauth2/userinfo/",
    });
  });
});
