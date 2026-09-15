import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runWithCloudflareRuntimeEnv,
  setCloudflareRequestContext,
} from "@/lib/adapters/cloudflare-runtime";
import {
  getOAuthDebugMode,
  logOAuthDebug,
  oauthDebugCorrelationId,
  summarizeOAuthAuthorizeUrl,
  summarizeOAuthRedirectLocation,
  summarizeOAuthRedirectUri,
} from "@/lib/log/oauth-debug";
import {
  tokenErrorBody,
  tokenRequestFingerprint,
} from "@/lib/log/oauth-debug-token";

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

  it("仅汇总重定向结构而不保留任何查询值", () => {
    expect(
      summarizeOAuthRedirectLocation(
        "/callback?code=secret&state=private-state&custom=private-value",
        "https://life.example.com/api/auth",
      ),
    ).toEqual({
      redirectOrigin: "https://life.example.com",
      redirectHost: "life.example.com",
      redirectHostname: "life.example.com",
      redirectPort: null,
      redirectPath: "/callback",
      redirectQueryKeys: ["code", "custom", "state"],
    });
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

  it("does not echo invalid redirect locations or OAuth resources", () => {
    const privateInvalidLocation = "https://[private-invalid-location";
    const privateResource = "https://private-resource.example/secret";

    expect(
      summarizeOAuthRedirectLocation(
        privateInvalidLocation,
        "https://life.example.com/api/auth",
      ),
    ).toEqual({
      redirectOrigin: null,
      redirectHost: "invalid_redirect_uri",
      redirectHostname: null,
      redirectPort: null,
      redirectPath: null,
      redirectQueryKeys: [],
    });
    const summary = summarizeOAuthAuthorizeUrl(
      new URL(
        `https://life.example.com/api/auth/oauth2/authorize?resource=${encodeURIComponent(privateResource)}`,
      ),
    );

    expect(summary).toMatchObject({ resourcePresent: true });
    expect(JSON.stringify(summary)).not.toContain(privateResource);
  });

  it("summarizes token requests and errors without sensitive values", async () => {
    const privateResource = "https://private-resource.example/secret";
    const privateNonce = "private-debug-nonce";
    const privateIp = "203.0.113.42";
    const request = new Request(
      "https://life.example.com/api/auth/oauth2/token",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-debug-nonce": privateNonce,
          "x-forwarded-for": privateIp,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          resource: privateResource,
        }),
      },
    );
    const fingerprint = await tokenRequestFingerprint(request);
    const errorBody = await tokenErrorBody(
      Response.json(
        {
          error: "invalid_grant",
          error_description: "private token error detail",
        },
        { status: 400 },
      ),
    );

    expect(fingerprint).toMatchObject({
      debugNoncePresent: true,
      forwardedPresent: true,
      hasResource: true,
      resourceCount: 1,
    });
    expect(errorBody).toEqual({
      error: "invalid_grant",
      errorDescriptionPresent: true,
    });
    expect(JSON.stringify([fingerprint, errorBody])).not.toContain("private");
    expect(JSON.stringify(fingerprint)).not.toContain(privateIp);
  });

  it("通过共享日志器继承规范请求上下文", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OAUTH_DEBUG_LOGGING", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await runWithCloudflareRuntimeEnv({}, () => {
      setCloudflareRequestContext({
        method: "POST",
        requestId: "request-1",
        route: "/api/auth/:id",
      });
      logOAuthDebug("oauth.test", undefined, { status: 400 });
    });

    const [payload] = info.mock.calls[0] ?? [];
    expect(JSON.parse(String(payload))).toMatchObject({
      prefix: "[app]",
      event: "oauth.test",
      method: "POST",
      requestId: "request-1",
      route: "/api/auth/:id",
      status: 400,
    });
  });

  it("不使用客户端 request ID 作为调试关联 ID", () => {
    const request = new Request("https://life.example/api/auth", {
      headers: {
        "cf-ray": "trusted-edge-ray",
        "x-request-id": "client-controlled-request-id",
      },
    });

    expect(oauthDebugCorrelationId(request)).toBe("trusted-edge-ray");
  });
});
