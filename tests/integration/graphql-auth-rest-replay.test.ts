import { describe, expect } from "vitest";
import { resolveGraphqlPrincipal } from "@/lib/graphql/auth";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthRestAudienceUrls,
} from "@/lib/oauth/resource-urls";
import { graphqlAuthTest } from "../shared/graphql-auth-contract-fixture";

describe("GraphQL OAuth resource isolation", () => {
  graphqlAuthTest.for([["REST", getOAuthRestAudienceUrls()[0] as string]])(
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
