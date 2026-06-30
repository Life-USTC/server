import { describe, expect, it } from "vitest";
import {
  isSupportedOAuthClientAuthMethod,
  OAUTH_CLIENT_SECRET_BASIC_AUTH_METHOD,
  OAUTH_CLIENT_SECRET_POST_AUTH_METHOD,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
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
});
