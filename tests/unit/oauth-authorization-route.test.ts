import { beforeEach, describe, expect, it, vi } from "vitest";

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
  betterAuthInstance: { handler: authHandlerMock },
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
        body: JSON.stringify({ created: true }),
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
      undefined,
      request.url,
      undefined,
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
        body: JSON.stringify({ created: true }),
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
});
