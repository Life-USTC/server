import { describe, expect } from "vitest";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { graphqlMutationTest as it } from "../shared/graphql-mutation-fixture";

describe("remaining GraphQL and MCP mutation parity", () => {
  it("graphql.comment-batch-results", { tags: ["@Comment/GraphQL"] }, async ({
    graphql,
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const { signToken, execute, ownedCommentId, otherCommentId } = graphql;
      const token = await signToken([restWriteScope("community.comment")]);
      const comments = await execute(
        {
          query: /* GraphQL */ `
            mutation DeleteComments($ids: [ID!]!) {
              commentsDelete(ids: $ids) {
                results {
                  success
                  id
                  error {
                    code
                    message
                  }
                }
              }
            }
          `,
          variables: { ids: [ownedCommentId, otherCommentId] },
        },
        token,
      );
      expect(comments.payload.errors).toBeUndefined();
      expect(comments.payload.data?.commentsDelete).toEqual({
        results: [
          { success: true, id: ownedCommentId, error: null },
          {
            success: false,
            id: otherCommentId,
            error: { code: "FORBIDDEN", message: "Forbidden" },
          },
        ],
      });
    });
  });
});
