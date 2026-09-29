import { describe, expect } from "vitest";
import { graphqlMutationTest as it } from "../shared/graphql-mutation-fixture";

describe("remaining GraphQL and MCP mutation parity", () => {
  it("runs the registered workspace and comment batch operations", async ({
    graphql,
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const { mcp, run, mcpCommentId } = graphql;
      const workspaceResult = await run(() =>
        mcp.call<{
          success: boolean;
          data: {
            linkPinsSet: {
              pinnedSlugs: string[];
              maxPinnedLinks: number;
            };
          };
        }>("graphql_operation_run", {
          operationId: "workspace.link_pin.batch_set.v1",
          variables: { items: [{ slug: "mail", pinned: true }] },
          confirmed: true,
          locale: "en-us",
        }),
      );
      expect(workspaceResult).toMatchObject({
        success: true,
        data: {
          linkPinsSet: {
            pinnedSlugs: ["mail"],
            maxPinnedLinks: 4,
          },
        },
      });

      const comments = await run(() =>
        mcp.call<{
          success: boolean;
          data: {
            commentsDelete: {
              results: Array<{ success: boolean; id: string }>;
            };
          };
        }>("graphql_operation_run", {
          operationId: "community.comments.delete.v1",
          variables: { ids: [mcpCommentId] },
          confirmed: true,
          locale: "en-us",
        }),
      );
      expect(comments).toMatchObject({
        success: true,
        data: {
          commentsDelete: {
            results: [{ success: true, id: mcpCommentId }],
          },
        },
      });
    });
  });
});
