import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { revokeUserOAuthAuthorization } from "@/features/oauth/server/user-authorizations.server";
import { resolveApiUserId } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/db/prisma";
import { resolveGraphqlPrincipal } from "@/lib/graphql/auth";
import { verifyAccessToken as verifyMcpAccessToken } from "@/lib/mcp/auth";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
  getOAuthRestAudienceUrls,
} from "@/lib/oauth/resource-urls";
import { restReadScope } from "@/lib/oauth/scope-registry";

const marker = crypto.randomUUID();
const clientId = `graphql-auth-${marker}`;
let consentId = "";
let grantId = "";
let userId = "";

async function signToken(resource: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await signResourceBoundOAuthAccessToken({
    clientId,
    expiresAt: issuedAt + 300,
    grantId,
    issuedAt,
    resources: [resource],
    scopes: [restReadScope("account.profile")],
    userId,
  });
  if (!token) throw new Error("Expected a signed access token");
  return token;
}

describe.sequential("GraphQL OAuth resource isolation", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `graphql-auth-${marker}@example.test`,
        name: "GraphQL auth integration",
      },
      select: { id: true },
    });
    userId = user.id;
    const client = await prisma.oAuthClient.create({
      data: {
        clientId,
        consents: {
          create: {
            scopes: [restReadScope("account.profile")],
            userId,
          },
        },
        name: "GraphQL auth integration",
        redirectUris: ["https://graphql.example/callback"],
      },
      select: {
        consents: {
          select: { grantId: true, id: true },
        },
      },
    });
    consentId = client.consents[0]?.id ?? "";
    grantId = client.consents[0]?.grantId ?? "";
    if (!consentId || !grantId) {
      throw new Error("Expected an OAuth consent fixture");
    }
  });

  afterAll(async () => {
    await prisma.oAuthClient.deleteMany({ where: { clientId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("接受 GraphQL-bound JWT principal", async () => {
    const token = await signToken(getOAuthGraphqlResourceUrl());

    await expect(
      resolveGraphqlPrincipal(
        new Request(getOAuthGraphqlResourceUrl(), {
          headers: { authorization: `Bearer ${token}` },
        }),
      ),
    ).resolves.toMatchObject({
      kind: "oauth",
      userId,
      resource: getOAuthGraphqlResourceUrl(),
      clientId,
    });
  });

  it.each([
    ["MCP", getOAuthMcpResourceUrl()],
    ["REST", getOAuthRestAudienceUrls()[0] as string],
  ])("拒绝重放 %s-bound JWT", async (_surface, resource) => {
    const token = await signToken(resource);

    await expect(
      resolveGraphqlPrincipal(
        new Request(getOAuthGraphqlResourceUrl(), {
          headers: { authorization: `Bearer ${token}` },
        }),
      ),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  });

  it("rejects the same REST, GraphQL, and MCP JWTs immediately after revocation", async () => {
    const [graphqlToken, mcpToken, restToken] = await Promise.all([
      signToken(getOAuthGraphqlResourceUrl()),
      signToken(getOAuthMcpResourceUrl()),
      signToken(getOAuthRestAudienceUrls()[0] as string),
    ]);

    await expect(
      resolveGraphqlPrincipal(
        new Request(getOAuthGraphqlResourceUrl(), {
          headers: { authorization: `Bearer ${graphqlToken}` },
        }),
      ),
    ).resolves.toMatchObject({ kind: "oauth", userId });
    await expect(
      resolveApiUserId(
        new Request(getOAuthRestAudienceUrls()[0] as string, {
          headers: { authorization: `Bearer ${restToken}` },
        }),
        { bearerScope: { action: "read", feature: "account.profile" } },
      ),
    ).resolves.toBe(userId);
    await expect(
      verifyMcpAccessToken(new Request(getOAuthMcpResourceUrl()), mcpToken),
    ).resolves.toMatchObject({
      clientId,
      extra: { userId },
    });

    await expect(
      revokeUserOAuthAuthorization(userId, consentId),
    ).resolves.toMatchObject({ ok: true });
    const replacementConsent = await prisma.oAuthConsent.create({
      data: {
        clientId,
        scopes: [restReadScope("account.profile")],
        userId,
      },
      select: { grantId: true, id: true },
    });
    consentId = replacementConsent.id;
    grantId = replacementConsent.grantId;

    await expect(
      resolveGraphqlPrincipal(
        new Request(getOAuthGraphqlResourceUrl(), {
          headers: { authorization: `Bearer ${graphqlToken}` },
        }),
      ),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
    await expect(
      resolveApiUserId(
        new Request(getOAuthRestAudienceUrls()[0] as string, {
          headers: { authorization: `Bearer ${restToken}` },
        }),
        { bearerScope: { action: "read", feature: "account.profile" } },
      ),
    ).resolves.toBeNull();
    await expect(
      verifyMcpAccessToken(new Request(getOAuthMcpResourceUrl()), mcpToken),
    ).resolves.toMatchObject({
      diagnostics: { authFailureKind: "inactive_oauth_grant" },
      error: "invalid_token",
      status: 401,
    });

    const replacementToken = await signToken(getOAuthGraphqlResourceUrl());
    await expect(
      resolveGraphqlPrincipal(
        new Request(getOAuthGraphqlResourceUrl(), {
          headers: { authorization: `Bearer ${replacementToken}` },
        }),
      ),
    ).resolves.toMatchObject({ kind: "oauth", userId });
  });
});
