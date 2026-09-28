import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { submitOAuthConsentAction } from "@/features/oauth/server/oauth-consent-action";
import { authGetRoute, authPostRoute } from "@/lib/api/routes/auth";
import { tokenPostRoute } from "@/lib/api/routes/auth-token";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const userId = `loopback-user-${marker}`;
const clientIds: string[] = [];
const origin = "http://localhost:3000";
const verifier = "v".repeat(64);
let cookie: string;
let challenge: string;
beforeAll(async () => {
  vi.stubEnv("E2E_DEBUG_AUTH", "1");
  await db.user.create({
    data: { id: userId, email: `${userId}@example.test` },
  });
  const token = crypto.randomUUID();
  await db.session.create({
    data: {
      userId,
      sessionToken: token,
      expires: new Date(Date.now() + 3_600_000),
    },
  });
  const context = await getBetterAuthInstance().$context;
  cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
  challenge = Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  ).toString("base64url");
});
afterAll(async () => {
  for (const clientId of clientIds)
    await db.verificationToken.deleteMany({
      where: { token: { contains: clientId } },
    });
  await db.auditLog.deleteMany({ where: { oauthClientId: { in: clientIds } } });
  await db.oAuthClient.deleteMany({ where: { clientId: { in: clientIds } } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
  vi.unstubAllEnvs();
});
async function register(redirectUri: string) {
  const response = await authPostRoute(
    new Request(`${origin}/api/auth/oauth2/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: `Loopback ${marker}`,
        application_type: "native",
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
        scope: "profile",
      }),
    }),
  );
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(201);
  clientIds.push(body.client_id);
  return body.client_id as string;
}
async function authorize(clientId: string, redirectUri: string) {
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "profile",
    state: marker,
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  const response = await authGetRoute(
    new Request(`${origin}/api/auth/oauth2/authorize?${query}`, {
      headers: { cookie, origin },
    }),
  );
  expect(response.status).toBe(302);
  return new URL(response.headers.get("location")!, origin);
}
async function consent(signed: URLSearchParams) {
  const redirect = await submitOAuthConsentAction({
    request: new Request(`${origin}/oauth/authorize`, {
      method: "POST",
      headers: { cookie, origin },
      body: new URLSearchParams({
        accept: "true",
        scope: "profile",
        oauthQuery: signed.toString(),
      }),
    }),
  }).catch((error: unknown) => error);
  expect(redirect).toMatchObject({ status: 303 });
  return new URL((redirect as { location: string }).location, origin);
}
async function exchange(clientId: string, code: string, redirectUri: string) {
  const response = await tokenPostRoute(
    new Request(`${origin}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    }),
  );
  return { response, body: await response.json() };
}

it("oauth.loopback-redirect-tolerance", { timeout: 30_000 }, async () => {
  for (const host of ["127.0.0.1", "[::1]", "localhost"]) {
    const registered = `http://${host}:61000/callback?instance=desktop`;
    const clientId = await register(registered);
    const allowed =
      host === "localhost"
        ? [registered]
        : [registered, registered.replace(":61000", ":62000")];
    for (const redirectUri of allowed) {
      const page = await authorize(clientId, redirectUri);
      expect(page.pathname).toBe("/oauth/authorize");
      expect(page.searchParams.get("redirect_uri")).toBe(redirectUri);
      const callback = await consent(page.searchParams);
      const code = callback.searchParams.get("code");
      expect(code, callback.toString()).toBeTruthy();
      expect(callback.origin).toBe(new URL(redirectUri).origin);
      expect(callback.pathname).toBe("/callback");
      expect(callback.searchParams.get("instance")).toBe("desktop");
      const issued = await exchange(clientId, code!, redirectUri);
      expect(issued.response.status, JSON.stringify(issued.body)).toBe(200);
      expect(typeof issued.body.access_token).toBe("string");
    }
    const replacements = [
      registered.replace(
        host,
        host === "localhost" ? "127.0.0.1" : "localhost",
      ),
      registered.replace("/callback", "/other"),
      registered.replace("instance=desktop", "instance=other"),
      registered.replace("http:", "https:"),
      ...(host === "localhost" ? [registered.replace(":61000", ":62000")] : []),
    ];
    for (const rejectedUri of replacements) {
      const rejected = await authorize(clientId, rejectedUri);
      expect(rejected.searchParams.get("error"), rejectedUri).toBe(
        "invalid_redirect",
      );
      expect(rejected.searchParams.get("code")).toBeNull();
      expect(rejected.origin).toBe(origin);
    }
    // The exchange must match the URI authorized with the code, including its port.
    for (const changed of [
      registered.replace(
        host,
        host === "localhost" ? "127.0.0.1" : "localhost",
      ),
      registered.replace(":61000", ":62001"),
    ]) {
      const page = await authorize(clientId, registered);
      const callback = await consent(page.searchParams);
      const denied = await exchange(
        clientId,
        callback.searchParams.get("code")!,
        changed,
      );
      expect(denied.response.status).toBe(400);
      expect(denied.body.access_token).toBeUndefined();
    }
  }
});
