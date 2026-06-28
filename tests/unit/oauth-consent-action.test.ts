import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitOAuthConsentAction } from "@/features/oauth/server/oauth-consent-action";

const { oauth2ConsentMock } = vi.hoisted(() => ({
  oauth2ConsentMock: vi.fn(),
}));

vi.mock("@/lib/auth/core", () => ({
  authApi: {
    adminCreateOAuthClient: vi.fn(),
    getOAuthClientPublic: vi.fn(),
    oauth2Consent: oauth2ConsentMock,
  },
}));

function consentRequest(
  body: Record<string, string>,
  options: { origin?: string | null } = {},
) {
  const headers = new Headers({
    cookie: "better-auth.session_token=session-token",
    "content-length": "999",
  });
  if (options.origin !== null) {
    headers.set("origin", options.origin ?? "https://life.example");
  }

  return new Request("https://life.example/oauth/authorize", {
    method: "POST",
    headers,
    body: new URLSearchParams(body),
  });
}

describe("OAuth consent 操作", () => {
  beforeEach(() => {
    oauth2ConsentMock.mockReset();
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://life.example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("使用 provider consent API 并重定向到目标", async () => {
    oauth2ConsentMock.mockResolvedValue({
      redirect_uri: "https://client.example/callback?code=code-1",
    });

    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "true",
          scope: "openid profile",
          oauthQuery: "client_id=client-1&state=state-1",
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: "https://client.example/callback?code=code-1",
    });

    expect(oauth2ConsentMock).toHaveBeenCalledWith({
      asResponse: false,
      headers: expect.any(Headers),
      request: expect.any(Request),
      body: {
        accept: true,
        scope: "openid profile",
        oauth_query: "client_id=client-1&state=state-1",
      },
    });
    const headers = oauth2ConsentMock.mock.calls[0][0].headers as Headers;
    const providerRequest = oauth2ConsentMock.mock.calls[0][0]
      .request as Request;
    expect(providerRequest.url).toBe(
      "https://life.example/api/auth/oauth2/consent",
    );
    expect(providerRequest.headers.get("cookie")).toBe(
      "better-auth.session_token=session-token",
    );
    expect(headers.get("cookie")).toBe(
      "better-auth.session_token=session-token",
    );
    expect(headers.get("content-length")).toBeNull();
    expect(headers.get("accept")).toBe("application/json");
  });

  it("provider consent 失败时重定向到 consent 失败页面", async () => {
    oauth2ConsentMock.mockRejectedValue(new Error("provider failed"));

    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "false",
          scope: "openid profile",
          oauthQuery: "client_id=client-1&state=state-1",
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: "/error?error=consent_failed",
    });
  });

  it("拒绝缺少 origin 或 referer 的携带 cookie 的 consent 请求", async () => {
    await expect(
      submitOAuthConsentAction({
        request: consentRequest(
          {
            accept: "true",
            scope: "openid profile",
            oauthQuery: "client_id=client-1&state=state-1",
          },
          { origin: null },
        ),
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(oauth2ConsentMock).not.toHaveBeenCalled();
  });

  it("拒绝来自不受信任 origin 的携带 cookie 的 consent 请求", async () => {
    await expect(
      submitOAuthConsentAction({
        request: consentRequest(
          {
            accept: "true",
            scope: "openid profile",
            oauthQuery: "client_id=client-1&state=state-1",
          },
          { origin: "https://evil.example" },
        ),
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(oauth2ConsentMock).not.toHaveBeenCalled();
  });
});
