import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getOAuthDebugMode,
  sanitizeOAuthRedirectLocation,
  summarizeOAuthRedirectUri,
} from "@/lib/log/oauth-debug";

describe("oauth 调试日志", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("从环境变量解析调试日志模式", () => {
    vi.stubEnv("OAUTH_DEBUG_LOGGING", "");
    expect(getOAuthDebugMode()).toBe("off");

    vi.stubEnv("OAUTH_DEBUG_LOGGING", " false ");
    expect(getOAuthDebugMode()).toBe("off");

    vi.stubEnv("OAUTH_DEBUG_LOGGING", "2");
    expect(getOAuthDebugMode()).toBe("verbose");

    vi.stubEnv("OAUTH_DEBUG_LOGGING", "VERBOSE");
    expect(getOAuthDebugMode()).toBe("verbose");

    vi.stubEnv("OAUTH_DEBUG_LOGGING", " verbose ");
    expect(getOAuthDebugMode()).toBe("verbose");

    vi.stubEnv("OAUTH_DEBUG_LOGGING", "1");
    expect(getOAuthDebugMode()).toBe("standard");
  });

  it("编辑敏感的重定向查询值", () => {
    expect(
      sanitizeOAuthRedirectLocation(
        "/callback?code=secret&state=ok&access_token=token",
        "https://life.example.com/api/auth",
      ),
    ).toBe(
      "https://life.example.com/callback?code=%5BREDACTED%5D&state=ok&access_token=%5BREDACTED%5D",
    );
  });

  it("汇总重定向 URL 结构而不包含查询值", () => {
    expect(
      summarizeOAuthRedirectUri(
        "https://client.example:8443/callback?state=ok&code=secret",
      ),
    ).toEqual({
      redirectOrigin: "https://client.example:8443",
      redirectHost: "client.example:8443",
      redirectHostname: "client.example",
      redirectPort: "8443",
      redirectPath: "/callback",
      redirectQueryKeys: ["code", "state"],
    });
  });

  it("保持无效重定向汇总明确", () => {
    expect(summarizeOAuthRedirectUri("not a url")).toEqual({
      redirectOrigin: null,
      redirectHost: "invalid_redirect_uri",
      redirectHostname: null,
      redirectPort: null,
      redirectPath: null,
      redirectQueryKeys: [],
    });
  });
});
