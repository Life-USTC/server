import { describe, expect } from "vitest";
import { resolveGraphqlPrincipal } from "@/lib/graphql/auth";
import { getOAuthGraphqlResourceUrl } from "@/lib/oauth/resource-urls";
import { graphqlAuthTest } from "../shared/graphql-auth-contract-fixture";

describe("GraphQL OAuth resource isolation", () => {
  graphqlAuthTest(
    "接受 GraphQL-bound JWT principal",
    { tags: ["@OAuth/Service"] },
    async ({
      authorization: { clientId, userId, signToken },
      oauthRuntime,
    }) => {
      await oauthRuntime.run(async () => {
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
    },
  );
});
