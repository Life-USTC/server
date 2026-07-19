import { makeSignature } from "better-auth/crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const AUTH_SECRET = "oauth-route-test-secret-at-least-32-bytes";

const {
  authHandlerMock,
  bindCodeRedirectMock,
  getSessionFromHeadersMock,
  resolveActiveGrantMock,
} = vi.hoisted(() => ({
  authHandlerMock: vi.fn(),
  bindCodeRedirectMock: vi.fn(),
  getSessionFromHeadersMock: vi.fn(),
  resolveActiveGrantMock: vi.fn(),
}));

vi.mock("@/lib/auth/core", () => ({
  betterAuthInstance: {
    $context: Promise.resolve({ secret: AUTH_SECRET }),
    handler: authHandlerMock,
  },
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

vi.mock(
  "@/features/oauth/server/oauth-authorization-code-grant.server",
  () => ({
    bindOAuthAuthorizationCodeRedirectToActiveGrant: bindCodeRedirectMock,
  }),
);

vi.mock("@/lib/oauth/active-user-grant", () => ({
  hasActiveOAuthUserGrant: vi.fn(),
  resolveActiveOAuthUserGrant: resolveActiveGrantMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    oAuthClient: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

async function signedOAuthQuery(overrides: Record<string, string> = {}) {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: "client-1",
    redirect_uri: "https://client.example/callback",
    scope: "profile",
    state: "state-1",
    code_challenge: "test-code-challenge",
    code_challenge_method: "S256",
    exp: String(Math.floor(Date.now() / 1000) + 600),
    ...overrides,
  });
  query.set("sig", await makeSignature(query.toString(), AUTH_SECRET));
  return query.toString();
}

describe("OAuth authorization route grant binding", () => {
  beforeEach(() => {
    authHandlerMock.mockReset();
    bindCodeRedirectMock.mockReset();
    getSessionFromHeadersMock.mockReset();
    resolveActiveGrantMock.mockReset();
    getSessionFromHeadersMock.mockResolvedValue({ user: { id: "user-1" } });
    resolveActiveGrantMock.mockResolvedValue({
      consentId: "consent-1",
      grantId: "grant-1",
      kind: "consent",
    });
    authHandlerMock.mockResolvedValue(
      new Response(null, {
        headers: {
          location: "https://client.example/callback?code=code-1&state=state-1",
        },
        status: 302,
      }),
    );
  });

  it("returns a generation-bound authorization code unchanged", async () => {
    bindCodeRedirectMock.mockResolvedValue(true);
    const { authGetRoute } = await import("@/lib/api/routes/auth");
    const request = new Request(
      "https://life.example/api/auth/oauth2/authorize?client_id=client-1&scope=profile",
    );

    const response = await authGetRoute(request);

    expect(response.headers.get("location")).toContain("code=code-1");
    expect(bindCodeRedirectMock).toHaveBeenCalledWith(
      "https://client.example/callback?code=code-1&state=state-1",
      "client-1",
      request.url,
      "grant-1",
      expect.any(Date),
    );
    expect(resolveActiveGrantMock).toHaveBeenCalledWith({
      clientId: "client-1",
      scopes: ["profile"],
      userId: "user-1",
    });
  });

  it("uses the pre-handler generation for a JSON authorization redirect", async () => {
    authHandlerMock.mockResolvedValue(
      Response.json({
        url: "https://client.example/callback?code=code-1&state=state-1",
      }),
    );
    bindCodeRedirectMock.mockResolvedValue(true);
    const { authGetRoute } = await import("@/lib/api/routes/auth");
    const request = new Request(
      "https://life.example/api/auth/oauth2/authorize?client_id=client-1&scope=profile",
    );

    const response = await authGetRoute(request);

    await expect(response.json()).resolves.toMatchObject({
      url: "https://client.example/callback?code=code-1&state=state-1",
    });
    expect(bindCodeRedirectMock).toHaveBeenCalledWith(
      "https://client.example/callback?code=code-1&state=state-1",
      "client-1",
      request.url,
      "grant-1",
      expect.any(Date),
    );
  });

  it("replaces an unbound code with a fail-closed OAuth error", async () => {
    bindCodeRedirectMock.mockResolvedValue(false);
    const { authGetRoute } = await import("@/lib/api/routes/auth");

    const response = await authGetRoute(
      new Request(
        "https://life.example/api/auth/oauth2/authorize?client_id=client-1",
      ),
    );
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.searchParams.has("code")).toBe(false);
    expect(location.searchParams.get("error")).toBe("server_error");
    expect(location.searchParams.get("state")).toBe("state-1");
  });

  it("binds authorization codes returned by the continue endpoint", async () => {
    authHandlerMock.mockResolvedValue(
      Response.json({
        redirect: true,
        url: "https://client.example/callback?code=code-1&state=state-1",
      }),
    );
    bindCodeRedirectMock.mockResolvedValue(true);
    const { authPostRoute } = await import("@/lib/api/routes/auth");
    const request = new Request(
      "https://life.example/api/auth/oauth2/continue",
      {
        body: JSON.stringify({
          created: true,
          oauth_query: await signedOAuthQuery(),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    const response = await authPostRoute(request);

    await expect(response.json()).resolves.toMatchObject({
      url: "https://client.example/callback?code=code-1&state=state-1",
    });
    expect(bindCodeRedirectMock).toHaveBeenCalledWith(
      "https://client.example/callback?code=code-1&state=state-1",
      "client-1",
      request.url,
      "grant-1",
      expect.any(Date),
    );
  });

  it("removes an unbound code returned by the continue endpoint", async () => {
    authHandlerMock.mockResolvedValue(
      Response.json({
        redirect: true,
        url: "https://client.example/callback?code=code-1&state=state-1",
      }),
    );
    bindCodeRedirectMock.mockResolvedValue(false);
    const { authPostRoute } = await import("@/lib/api/routes/auth");

    const response = await authPostRoute(
      new Request("https://life.example/api/auth/oauth2/continue", {
        body: JSON.stringify({
          created: true,
          oauth_query: await signedOAuthQuery(),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    const body = (await response.json()) as { url: string };
    const location = new URL(body.url);

    expect(location.searchParams.has("code")).toBe(false);
    expect(location.searchParams.get("error")).toBe("server_error");
    expect(location.searchParams.get("state")).toBe("state-1");
  });

  it("binds a login response using the signed pre-handler generation", async () => {
    bindCodeRedirectMock.mockResolvedValue(true);
    const { authPostRoute } = await import("@/lib/api/routes/auth");
    const request = new Request(
      "https://life.example/api/auth/sign-in/passkey",
      {
        body: JSON.stringify({
          oauth_query: await signedOAuthQuery({ prompt: "login" }),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    const response = await authPostRoute(request);

    expect(response.headers.get("location")).toContain("code=code-1");
    expect(bindCodeRedirectMock).toHaveBeenCalledWith(
      "https://client.example/callback?code=code-1&state=state-1",
      "client-1",
      request.url,
      "grant-1",
      expect.any(Date),
    );
  });
});
