import { decodeJwt } from "jose";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createAcceptedOAuthAuthorization } from "@/features/oauth/server/oauth-consent-action";
import { tokenPostRoute } from "@/lib/api/routes/auth-token";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
} from "@/lib/oauth/resource-urls";
import { hashOAuthClientSecretForDbStorage } from "@/lib/oauth/utils";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const clientId = `resource-binding-${marker}`;
const userId = `resource-binding-user-${marker}`;
const redirectUri = "https://resource-binding.example/callback";
const verifier = "v".repeat(64);
const identifiers: string[] = [];
let challenge: string;

beforeAll(async () => {
  challenge = Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  ).toString("base64url");
  await db.user.create({
    data: { id: userId, email: `${userId}@example.test` },
  });
  await db.session.create({
    data: {
      id: `session-${marker}`,
      userId,
      sessionToken: `session-token-${marker}`,
      expires: new Date(Date.now() + 3600_000),
    },
  });
  await db.oAuthClient.create({
    data: {
      clientId,
      name: "Resource binding contract",
      public: true,
      requirePKCE: true,
      redirectUris: [redirectUri],
      grantTypes: ["authorization_code", "refresh_token"],
      responseTypes: ["code"],
      scopes: ["openid", "profile", "offline_access", "workspace.todo:read"],
      tokenEndpointAuthMethod: "none",
    },
  });
});
afterAll(async () => {
  await db.verificationToken.deleteMany({
    where: { identifier: { in: identifiers } },
  });
  await db.oAuthClient.deleteMany({ where: { clientId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});
async function authorize(resource: string) {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid offline_access workspace.todo:read",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource,
  });
  const result = await createAcceptedOAuthAuthorization({
    acceptedScopes: ["openid", "offline_access", "workspace.todo:read"],
    authorizeQuery: query,
    session: {
      user: { id: userId },
      session: { id: `session-${marker}`, createdAt: new Date() },
    },
  });
  if (!result) throw new Error("Expected consent authorization");
  const code = new URL(result.redirectTarget).searchParams.get("code");
  if (!code) throw new Error("Expected authorization code");
  identifiers.push(await hashOAuthClientSecretForDbStorage(code));
  return code;
}
async function token(params: Record<string, string>) {
  return tokenPostRoute(
    new Request(new URL("/api/auth/oauth2/token", getOAuthMcpResourceUrl()), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, ...params }),
    }),
  );
}
it("oauth.authorization-code-resource-binding", {
  timeout: 30_000,
}, async () => {
  const mcp = getOAuthMcpResourceUrl();
  const graphql = getOAuthGraphqlResourceUrl();
  for (const requestedResource of [mcp, graphql]) {
    const code = await authorize(mcp);
    const row = await db.verificationToken.findFirstOrThrow({
      where: { identifier: await hashOAuthClientSecretForDbStorage(code) },
    });
    expect(JSON.parse(row.token).query.resource).toBe(mcp);
    const response = await token({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      resource: requestedResource,
    });
    const result = await response.json();
    if (requestedResource === mcp) {
      expect(response.status, JSON.stringify(result)).toBe(200);
      expect(decodeJwt(result.access_token).aud).toEqual([
        mcp,
        new URL("/api/auth/oauth2/userinfo", mcp).toString(),
      ]);
      expect(typeof result.refresh_token).toBe("string");
    } else {
      expect(response.status, JSON.stringify(result)).toBe(400);
      expect(result.error).toBe("invalid_target");
      expect(result.access_token).toBeUndefined();
    }
  }
});

it("oauth.rotated-refresh-replay", async () => {
  const mcp = getOAuthMcpResourceUrl();
  const code = await authorize(mcp);
  const issued = await token({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    resource: mcp,
  });
  const first = await issued.json();
  expect(issued.status, JSON.stringify(first)).toBe(200);
  expect(typeof first.refresh_token).toBe("string");
  const rotated = await token({
    grant_type: "refresh_token",
    refresh_token: first.refresh_token,
    resource: mcp,
  });
  const replacement = await rotated.json();
  expect(rotated.status, JSON.stringify(replacement)).toBe(200);
  expect(typeof replacement.refresh_token).toBe("string");
  expect(replacement.refresh_token).not.toBe(first.refresh_token);
  const oldTokenHash = await hashOAuthClientSecretForDbStorage(
    first.refresh_token,
  );
  const old = await db.oAuthRefreshToken.findUniqueOrThrow({
    where: { token: oldTokenHash },
  });
  expect(old.rotatedAt ?? old.revoked).not.toBeNull();
  // The provider allows a bounded retry interval for a just-rotated token.
  // Move that actual persisted rotation outside the interval without sleeping.
  await db.oAuthRefreshToken.update({
    where: { id: old.id },
    data: {
      ...(old.rotatedAt ? { rotatedAt: new Date(Date.now() - 60_000) } : {}),
      ...(old.revoked ? { revoked: new Date(Date.now() - 60_000) } : {}),
    },
  });
  const replay = await token({
    grant_type: "refresh_token",
    refresh_token: first.refresh_token,
    resource: mcp,
  });
  expect(replay.status).toBe(400);
  const failure = await replay.json();
  expect(failure.error).toBe("invalid_grant");
  expect(failure).not.toHaveProperty("access_token");
  expect(failure).not.toHaveProperty("refresh_token");
});
