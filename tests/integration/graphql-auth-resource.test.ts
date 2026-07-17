import { describe, expect, it } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { resolveGraphqlPrincipal } from "@/lib/graphql/auth";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
  getOAuthRestAudienceUrls,
} from "@/lib/oauth/resource-urls";
import { restReadScope } from "@/lib/oauth/scope-registry";

async function signToken(resource: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await signResourceBoundOAuthAccessToken({
    clientId: "graphql-auth-integration",
    expiresAt: issuedAt + 300,
    issuedAt,
    resources: [resource],
    scopes: [restReadScope("me")],
    userId: "graphql-auth-user",
  });
  if (!token) throw new Error("Expected a signed access token");
  return token;
}

describe("GraphQL OAuth resource isolation", () => {
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
      userId: "graphql-auth-user",
      resource: getOAuthGraphqlResourceUrl(),
      clientId: "graphql-auth-integration",
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
});
