import { afterAll, beforeAll, expect, it } from "vitest";
import { decodeJwt } from "jose";
import { createAcceptedOAuthAuthorization } from "@/features/oauth/server/oauth-consent-action";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { issueResourceBoundRefreshAccessToken } from "@/features/oauth/server/refresh-token-resources.server";
import { maybeBindOAuthRefreshResourceRequest } from "@/lib/api/routes/auth-token-refresh-resource-binding";
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
it(
  "oauth.authorization-code-resource-binding",
  { timeout: 30_000 },
  async () => {
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
  },
);

async function refreshFixture(input: {
  resources: string[];
  scopes: string[];
  confirmation?: { jkt: string };
}) {
  const raw = crypto.randomUUID();
  await db.oAuthRefreshToken.create({
    data: {
      clientId,
      userId,
      token: await hashOAuthClientSecretForDbStorage(raw),
      expiresAt: new Date(Date.now() + 3600_000),
      resources: input.resources,
      scopes: input.scopes,
      ...(input.confirmation ? { confirmation: input.confirmation } : {}),
    },
  });
  return raw;
}
it("oauth.mcp-refresh-resource-binding", async () => {
  const mcp = getOAuthMcpResourceUrl();
  const cases = [
    { resources: [mcp], scopes: ["workspace.todo:read"], expected: mcp },
    { resources: [], scopes: ["workspace.todo:read"], expected: undefined },
    { resources: [mcp], scopes: ["profile"], expected: undefined },
    {
      resources: [mcp],
      scopes: ["profile"],
      scope: "workspace.todo:read",
      expected: undefined,
    },
    {
      resources: [mcp],
      scopes: ["workspace.todo:read", "profile"],
      scope: "profile",
      expected: undefined,
    },
    {
      resources: [mcp, getOAuthGraphqlResourceUrl()],
      scopes: ["workspace.todo:read"],
      expected: undefined,
    },
    {
      resources: [mcp, "not-a-resource"],
      scopes: ["workspace.todo:read"],
      expected: undefined,
    },
    {
      resources: [new URL("/api/auth", mcp).toString()],
      scopes: ["workspace.todo:read"],
      expected: undefined,
    },
  ];
  for (const scenario of cases) {
    const raw = await refreshFixture(scenario);
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: raw,
      ...(scenario.scope ? { scope: scenario.scope } : {}),
    });
    const request = new Request(new URL("/api/auth/oauth2/token", mcp), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const prepared = await maybeBindOAuthRefreshResourceRequest(
      request,
      params,
    );
    expect(params.get("resource")).toBe(scenario.expected ?? null);
    expect(new URLSearchParams(await prepared.text()).get("resource")).toBe(
      scenario.expected ?? null,
    );
    if (!scenario.expected) expect(prepared).toBe(request);
  }
});

it("oauth.refresh-confirmation-binding", { timeout: 30_000 }, async () => {
  const resource = getOAuthMcpResourceUrl();
  const cases: Array<{
    stored?: { jkt: string };
    issued?: { jkt: string };
    type: string;
    valid: boolean;
    tampered?: boolean;
  }> = [
    { type: "Bearer", valid: true },
    {
      stored: { jkt: "same" },
      issued: { jkt: "same" },
      type: "DPoP",
      valid: true,
    },
    { issued: { jkt: "upgraded" }, type: "DPoP", valid: true },
    {
      stored: { jkt: "old" },
      issued: { jkt: "new" },
      type: "DPoP",
      valid: false,
    },
    { stored: { jkt: "old" }, type: "Bearer", valid: false },
    { issued: { jkt: "same" }, type: "Bearer", valid: false },
    { type: "DPoP", valid: false },
    { stored: { jkt: "" }, type: "Bearer", valid: false },
    { issued: { jkt: "" }, type: "DPoP", valid: false },
    { type: "Bearer", valid: false, tampered: true },
  ];
  for (const scenario of cases) {
    const refreshToken = await refreshFixture({
      resources: [resource],
      scopes: ["workspace.todo:read"],
      confirmation: scenario.stored,
    });
    const issuedAt = Math.floor(Date.now() / 1000);
    let accessToken = await signResourceBoundOAuthAccessToken({
      clientId,
      userId,
      resources: [resource],
      scopes: ["workspace.todo:read"],
      confirmation: scenario.issued,
      issuedAt,
      expiresAt: issuedAt + 300,
    });
    if (!accessToken) throw new Error("Expected signed token");
    if (scenario.tampered) {
      const parts = accessToken.split(".");
      parts[1] = Buffer.from(
        JSON.stringify({ ...decodeJwt(accessToken), sub: "forged-user" }),
      ).toString("base64url");
      accessToken = parts.join(".");
    }
    const replacement = await issueResourceBoundRefreshAccessToken({
      refreshToken,
      resourceValues: [resource],
      effectiveScopes: ["workspace.todo:read"],
      issuedAccessToken: accessToken,
      issuedTokenType: scenario.type,
    });
    if (scenario.valid) {
      expect(replacement).toBeDefined();
      expect(replacement?.tokenType).toBe(scenario.type);
      const claims = decodeJwt(replacement!.accessToken);
      expect(claims.cnf).toEqual(scenario.issued);
      expect(claims.aud).toEqual(resource);
    } else {
      expect(replacement).toBeUndefined();
    }
  }
});
