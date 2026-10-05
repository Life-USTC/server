import { describe, expect } from "vitest";
import { resolveGraphqlPrincipal } from "@/lib/graphql/auth";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
} from "@/lib/oauth/resource-urls";
import { graphqlAuthTest } from "../shared/graphql-auth-contract-fixture";

describe("GraphQL OAuth resource isolation", () => {
  graphqlAuthTest.for([["MCP", getOAuthMcpResourceUrl()]])(
    "拒绝重放 %s-bound JWT",
    { tags: ["@OAuth/Service"] },
    async (
      [_surface, resource],
      { authorization: { signToken }, oauthRuntime },
    ) => {
      await oauthRuntime.run(async () => {
        const token = await signToken(resource);

        await expect(
          resolveGraphqlPrincipal(
            new Request(getOAuthGraphqlResourceUrl(), {
              headers: { authorization: `Bearer ${token}` },
            }),
          ),
        ).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
      });
    },
  );
});
