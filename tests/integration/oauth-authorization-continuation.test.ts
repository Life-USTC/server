import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { authPostRoute } from "@/lib/api/routes/auth";
import { prisma } from "@/lib/db/prisma";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";

const AUTH_SECRET =
  "oauth-authorization-continuation-test-secret-at-least-32-bytes";

const { authHandlerMock, getSessionFromHeadersMock } = vi.hoisted(() => ({
  authHandlerMock: vi.fn(),
  getSessionFromHeadersMock: vi.fn(),
}));

vi.mock("@/lib/auth/core", () => ({
  betterAuthInstance: {
    $context: Promise.resolve({ secret: AUTH_SECRET }),
    handler: authHandlerMock,
  },
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

describe.sequential("OAuth authorization continuation grant binding", () => {
  const marker = crypto.randomUUID();
  const clientId = `oauth-continuation-${marker}`;
  const verificationIdentifiers: string[] = [];
  let grantId = "";
  let userId = "";

  async function signedOAuthQuery(prompt: string, state: string) {
    const query = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: "https://client.example/callback",
      scope: "profile",
      state,
      prompt,
      code_challenge: "integration-code-challenge",
      code_challenge_method: "S256",
      exp: String(Math.floor(Date.now() / 1000) + 600),
    });
    query.set("sig", await makeSignature(query.toString(), AUTH_SECRET));
    return query.toString();
  }

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `oauth-continuation-${marker}@example.test`,
        name: "OAuth continuation user",
      },
      select: { id: true },
    });
    userId = user.id;
    await prisma.oAuthClient.create({
      data: {
        clientId,
        name: "OAuth continuation client",
        redirectUris: ["https://client.example/callback"],
        scopes: ["profile"],
      },
    });
    const consent = await prisma.oAuthConsent.create({
      data: {
        clientId,
        scopes: ["profile"],
        userId,
      },
      select: { grantId: true },
    });
    grantId = consent.grantId;
    getSessionFromHeadersMock.mockResolvedValue({ user: { id: userId } });

    authHandlerMock.mockImplementation(async (request: Request) => {
      const body = (await request.clone().json()) as {
        oauth_query: string;
      };
      const signed = new URLSearchParams(body.oauth_query);
      const state = signed.get("state") ?? "";
      for (const field of ["sig", "exp", "ba_iat", "ba_pl"]) {
        signed.delete(field);
      }
      const code = `continuation-${state}-${marker}`;
      const identifier = await hashOAuthClientSecretForDbStorage(code);
      verificationIdentifiers.push(identifier);
      await prisma.verificationToken.create({
        data: {
          identifier,
          token: JSON.stringify({
            type: "authorization_code",
            query: Object.fromEntries(signed.entries()),
            userId,
            sessionId: `session-${marker}`,
          }),
          expires: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
      return Response.json({
        redirect: true,
        url: `https://client.example/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
      });
    });
  });

  afterAll(async () => {
    await prisma.verificationToken.deleteMany({
      where: { identifier: { in: verificationIdentifiers } },
    });
    await prisma.oAuthClient.deleteMany({ where: { clientId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it.each([
    {
      body: { login: true },
      name: "login",
      path: "/api/auth/sign-in/passkey",
      prompt: "login",
    },
    {
      body: { created: true },
      name: "create",
      path: "/api/auth/oauth2/continue",
      prompt: "create",
    },
    {
      body: { selected: true },
      name: "select-account",
      path: "/api/auth/oauth2/continue",
      prompt: "select_account",
    },
    {
      body: { postLogin: true },
      name: "post-login",
      path: "/api/auth/oauth2/continue",
      prompt: "consent",
    },
  ])("真实 binder 为 $name continuation 绑定委托前 generation", async (entry) => {
    const state = `${entry.name}-${marker}`;
    const oauthQuery = await signedOAuthQuery(entry.prompt, state);
    const request = new Request(`https://life.example${entry.path}`, {
      body: JSON.stringify({ ...entry.body, oauth_query: oauthQuery }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const response = await authPostRoute(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      url: expect.stringContaining("code="),
    });

    const code = `continuation-${state}-${marker}`;
    const row = await prisma.verificationToken.findFirstOrThrow({
      where: {
        identifier: await hashOAuthClientSecretForDbStorage(code),
      },
      select: { token: true },
    });
    expect(JSON.parse(row.token)).toMatchObject({
      referenceId: grantId,
      type: "authorization_code",
      userId,
    });
  });

  it("login 前无 session 时绑定登录后 code user 的当前 generation", async () => {
    getSessionFromHeadersMock.mockResolvedValueOnce(null);
    const state = `logged-out-login-${marker}`;
    const request = new Request(
      "https://life.example/api/auth/sign-in/passkey",
      {
        body: JSON.stringify({
          login: true,
          oauth_query: await signedOAuthQuery("login", state),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    const response = await authPostRoute(request);
    expect(response.status).toBe(200);
    const code = `continuation-${state}-${marker}`;
    const row = await prisma.verificationToken.findFirstOrThrow({
      where: {
        identifier: await hashOAuthClientSecretForDbStorage(code),
      },
      select: { token: true },
    });
    expect(JSON.parse(row.token)).toMatchObject({
      referenceId: grantId,
      type: "authorization_code",
      userId,
    });
  });
});
