import { describe, expect } from "vitest";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";
import { continuationTest } from "../shared/oauth-continuation-fixture";

describe("OAuth authorization continuation grant binding", () => {
  for (const entry of [
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
  ]) {
    continuationTest(
      `真实 binder 为 ${entry.name} continuation 绑定委托前 generation`,
      async ({
        continuation,
        continuationRuntime,
        isolatedDatabase: { owner: fixturePrisma },
      }) => {
        await continuationRuntime.run(async () => {
          const { marker, userId, grantId, signedOAuthQuery } = continuation;
          const state = `${entry.name}-${marker}`;
          const oauthQuery = await signedOAuthQuery(entry.prompt, state);
          const request = new Request(`https://life.example${entry.path}`, {
            body: JSON.stringify({ ...entry.body, oauth_query: oauthQuery }),
            headers: { "content-type": "application/json" },
            method: "POST",
          });

          const response = await continuation.authorize(request);
          expect(response.status).toBe(200);
          await expect(response.json()).resolves.toMatchObject({
            url: expect.stringContaining("code="),
          });

          const code = `continuation-${state}-${marker}`;
          const row = await fixturePrisma.verificationToken.findFirstOrThrow({
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
      },
    );
  }
  continuationTest(
    "login 前无 session 时绑定登录后 code user 的当前 generation",
    async ({
      continuation,
      continuationRuntime,
      isolatedDatabase: { owner: fixturePrisma },
    }) => {
      await continuationRuntime.run(async () => {
        const { marker, userId, grantId, signedOAuthQuery } = continuation;
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

        const response = await continuation.authorize(request, false);
        expect(response.status).toBe(200);
        await response.text();
        const code = `continuation-${state}-${marker}`;
        const row = await fixturePrisma.verificationToken.findFirstOrThrow({
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
    },
  );
});
