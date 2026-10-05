import { describe, expect } from "vitest";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { graphqlMutationTest as it } from "../shared/graphql-mutation-fixture";

describe("remaining GraphQL and MCP mutation parity", () => {
  it("graphql.pin-batch-order", { tags: ["@CatalogLink/GraphQL"] }, async ({
    graphql,
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const { signToken, execute } = graphql;
      const token = await signToken([
        restWriteScope("workspace.link-pin"),
        restWriteScope("community.comment"),
      ]);
      const workspaceResult = await execute(
        {
          query: /* GraphQL */ `
            mutation WorkspaceBatch(
              $items: [WorkspaceLinkPinBatchItemInput!]!
            ) {
              linkPinsSet(items: $items) {
                pinnedSlugs
                maxPinnedLinks
              }
            }
          `,
          variables: {
            items: [
              { slug: "mail", pinned: true },
              { slug: "mail", pinned: false },
            ],
          },
        },
        token,
      );
      expect(workspaceResult.payload.errors).toBeUndefined();
      expect(workspaceResult.payload.data?.linkPinsSet).toEqual({
        pinnedSlugs: [],
        maxPinnedLinks: 4,
      });
    });
  });
});
