import { describe, expect } from "vitest";
import { revokeUserOAuthAuthorization } from "@/features/oauth/server/user-authorizations.server";
import { resolveScopedApiUserId } from "@/lib/auth/api-auth";
import { resolveGraphqlPrincipal } from "@/lib/graphql/auth";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
  getOAuthRestAudienceUrls,
} from "@/lib/oauth/resource-urls";
import { restReadScope } from "@/lib/oauth/scope-registry";
import {
  authorizeMcpToken,
  graphqlAuthTest,
} from "../shared/graphql-auth-contract-fixture";

describe("GraphQL OAuth resource isolation", () => {
  graphqlAuthTest(
    "rejects the same REST, GraphQL, and MCP JWTs immediately after revocation",
    async ({
      authorization: { fixturePrisma, clientId, userId, grant, signToken },
      oauthRuntime,
    }) => {
      await oauthRuntime.run(async () => {
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
          resolveScopedApiUserId(
            new Request(getOAuthRestAudienceUrls()[0] as string, {
              headers: { authorization: `Bearer ${restToken}` },
            }),
            { action: "read", feature: "account.profile" },
          ),
        ).resolves.toBe(userId);
        await expect(authorizeMcpToken(mcpToken)).resolves.toMatchObject({
          clientId,
          extra: { userId },
        });

        await expect(
          revokeUserOAuthAuthorization(userId, grant.consentId),
        ).resolves.toMatchObject({ ok: true });
        const replacementConsent = await fixturePrisma.oAuthConsent.create({
          data: {
            clientId,
            scopes: [restReadScope("account.profile")],
            userId,
          },
          select: { grantId: true, id: true },
        });
        grant.consentId = replacementConsent.id;
        grant.grantId = replacementConsent.grantId;

        await expect(
          resolveGraphqlPrincipal(
            new Request(getOAuthGraphqlResourceUrl(), {
              headers: { authorization: `Bearer ${graphqlToken}` },
            }),
          ),
        ).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
        await expect(
          resolveScopedApiUserId(
            new Request(getOAuthRestAudienceUrls()[0] as string, {
              headers: { authorization: `Bearer ${restToken}` },
            }),
            { action: "read", feature: "account.profile" },
          ),
        ).resolves.toBeNull();
        await expect(authorizeMcpToken(mcpToken)).resolves.toMatchObject({
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
    },
  );
});
