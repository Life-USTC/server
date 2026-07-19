import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitOAuthConsentAction } from "@/features/oauth/server/oauth-consent-action";

const {
  bindCodeMock,
  getSessionMock,
  oauth2AuthorizeMock,
  oauth2ConsentMock,
  rotateGrantMock,
  verificationCreateMock,
} = vi.hoisted(() => ({
  bindCodeMock: vi.fn(),
  getSessionMock: vi.fn(),
  oauth2AuthorizeMock: vi.fn(),
  oauth2ConsentMock: vi.fn(),
  rotateGrantMock: vi.fn(),
  verificationCreateMock: vi.fn(),
}));

vi.mock(
  "@/features/oauth/server/oauth-authorization-code-grant.server",
  () => ({
    bindOAuthAuthorizationCodeRedirectToActiveGrant: bindCodeMock,
  }),
);

vi.mock("@/lib/auth/core", () => ({
  authApi: {
    adminCreateOAuthClient: vi.fn(),
    getOAuthClientPublic: vi.fn(),
    getSession: getSessionMock,
    oauth2Authorize: oauth2AuthorizeMock,
    oauth2Consent: oauth2ConsentMock,
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    verificationToken: {
      create: verificationCreateMock,
    },
  },
}));

vi.mock("@/features/oauth/server/user-authorizations.server", () => ({
  rotateOAuthUserGrantAfterConsent: rotateGrantMock,
}));

function consentRequest(
  body: Record<string, string> | URLSearchParams,
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
    body: body instanceof URLSearchParams ? body : new URLSearchParams(body),
  });
}

describe("OAuth consent 操作", () => {
  beforeEach(() => {
    bindCodeMock.mockReset();
    getSessionMock.mockReset();
    oauth2AuthorizeMock.mockReset();
    oauth2ConsentMock.mockReset();
    rotateGrantMock.mockReset();
    verificationCreateMock.mockReset();
    getSessionMock.mockResolvedValue({
      session: {
        createdAt: new Date("2026-07-20T00:00:00.000Z"),
        id: "session-1",
      },
      user: { id: "user-1" },
    });
    bindCodeMock.mockResolvedValue(true);
    rotateGrantMock.mockResolvedValue({
      consentId: "consent-1",
      grantId: "grant-1",
      kind: "consent",
      scopes: ["openid", "profile"],
    });
    vi.stubEnv("APP_PUBLIC_ORIGIN", "https://life.example");
  });

  it("stores the exact rotated generation on the fallback authorization code", async () => {
    const authorizeRedirect =
      "/oauth/authorize?client_id=client-1&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&state=state-1";
    oauth2ConsentMock.mockResolvedValue({ redirect_uri: authorizeRedirect });
    oauth2AuthorizeMock.mockResolvedValue({ redirect_uri: authorizeRedirect });
    verificationCreateMock.mockResolvedValue({});

    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "true",
          scope: "profile",
          oauthQuery:
            "client_id=client-1&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&state=state-1",
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: expect.stringMatching(
        /^https:\/\/client\.example\/callback\?code=/,
      ),
    });

    const stored = JSON.parse(
      verificationCreateMock.mock.calls[0][0].data.token,
    );
    expect(stored).toMatchObject({
      referenceId: "grant-1",
      type: "authorization_code",
      userId: "user-1",
    });
    expect(bindCodeMock).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/client\.example\/callback\?code=/),
      "client-1",
      "https://life.example/oauth/authorize",
      "grant-1",
    );
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
    expect(rotateGrantMock).toHaveBeenCalledWith({
      clientId: "client-1",
      scopes: ["openid", "profile"],
      userId: "user-1",
    });
    expect(bindCodeMock).toHaveBeenCalledWith(
      "https://client.example/callback?code=code-1",
      "client-1",
      "https://life.example/oauth/authorize",
      "grant-1",
    );
  });

  it("does not attach an ordinary consent generation to a trusted client code", async () => {
    oauth2ConsentMock.mockResolvedValue({
      redirect_uri: "https://client.example/callback?code=code-1",
    });
    rotateGrantMock.mockResolvedValue({ kind: "trusted" });

    await expect(
      submitOAuthConsentAction({
        request: consentRequest({
          accept: "true",
          scope: "openid profile",
          oauthQuery: "client_id=trusted-client",
        }),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: "https://client.example/callback?code=code-1",
    });

    expect(bindCodeMock).toHaveBeenCalledWith(
      "https://client.example/callback?code=code-1",
      "trusted-client",
      "https://life.example/oauth/authorize",
      undefined,
    );
  });

  it("narrows allowed scopes to checked scopes from the original authorize request", async () => {
    oauth2ConsentMock.mockResolvedValue({
      redirect_uri: "https://client.example/callback?code=code-1",
    });
    const body = new URLSearchParams({
      accept: "true",
      scope: "openid profile todo:read todo:write",
      scopeSelectionEnabled: "true",
      oauthQuery:
        "client_id=client-1&state=state-1&scope=openid+profile+todo%3Aread+todo%3Awrite",
    });
    body.append("scopes", "openid");
    body.append("scopes", "todo:read");
    body.append("scopes", "admin:write");

    await expect(
      submitOAuthConsentAction({
        request: consentRequest(body),
      }),
    ).rejects.toMatchObject({
      status: 303,
      location: "https://client.example/callback?code=code-1",
    });

    expect(oauth2ConsentMock.mock.calls[0][0].body).toMatchObject({
      accept: true,
      scope: "openid todo:read",
      oauth_query:
        "client_id=client-1&state=state-1&scope=openid+profile+todo%3Aread+todo%3Awrite",
    });
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
    expect(rotateGrantMock).not.toHaveBeenCalled();
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
