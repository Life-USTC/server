import { decodeJwt } from "jose";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { authorizeVerifiedMcpAccessToken } from "@/lib/mcp/auth-token-verification";
import { restReadScope } from "@/lib/oauth/scope-registry";
import { oauthProviderTest } from "./oauth-provider-runtime";
export function authorizeMcpToken(token: string) {
  return authorizeVerifiedMcpAccessToken({
    jwtClaims: decodeJwt(token),
    token,
  });
}

export const graphqlAuthTest = oauthProviderTest.extend(
  "authorization",
  async ({ isolatedDatabase: { owner: fixturePrisma }, oauthRuntime }) => {
    const marker = crypto.randomUUID();
    const clientId = `graphql-auth-${marker}`;
    const grant = await oauthRuntime.run(() =>
      fixturePrisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: `graphql-auth-${marker}@example.test`,
            name: "GraphQL auth integration",
          },
          select: { id: true },
        });
        const userId = user.id;
        const client = await tx.oAuthClient.create({
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
        const consentId = client.consents[0]?.id ?? "";
        const grantId = client.consents[0]?.grantId ?? "";
        if (!consentId || !grantId) {
          throw new Error("Expected an OAuth consent fixture");
        }
        return { userId, consentId, grantId };
      }),
    );
    const userId = grant.userId;
    async function signToken(resource: string) {
      return oauthRuntime.request(async () => {
        const issuedAt = Math.floor(Date.now() / 1000);
        const token = await signResourceBoundOAuthAccessToken({
          clientId,
          expiresAt: issuedAt + 300,
          grantId: grant.grantId,
          issuedAt,
          resources: [resource],
          scopes: [restReadScope("account.profile")],
          userId,
        });
        if (!token) throw new Error("Expected a signed access token");
        return token;
      });
    }

    return { fixturePrisma, clientId, userId, grant, signToken };
  },
);
