import { beforeEach, describe, expect, it, vi } from "vitest";
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

function consentRequest(body: Record<string, string>) {
  return new Request("https://life.example/oauth/authorize", {
    method: "POST",
    headers: {
      cookie: "better-auth.session_token=session-token",
      "content-length": "999",
    },
    body: new URLSearchParams(body),
  });
}

describe("OAuth consent action", () => {
  beforeEach(() => {
    oauth2ConsentMock.mockReset();
  });

  it("uses the provider consent API and redirects to its target", async () => {
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

  it("redirects to the consent failure page when provider consent fails", async () => {
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
});
