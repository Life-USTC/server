import { describe, expect } from "vitest";
import { restReadScope } from "@/lib/oauth/scope-registry";
import { graphqlViewerTest as it } from "../shared/graphql-viewer-fixture";

describe("GraphQL Viewer integration", () => {
  it("graphql.scoped-query-auth", async ({ viewer: viewerCase }) => {
    await viewerCase.run(async () => {
      const { execute, graphqlBearer, firstUserId, signToken } = viewerCase;
      const authorized = await execute(
        {
          query: /* GraphQL */ `
          {
            account {
              profile {
                id
              }
            }
            viewer: workspace {
              todos {
                pageInfo {
                  total
                }
              }
            }
          }
        `,
        },
        { authorization: `Bearer ${graphqlBearer}` },
      );
      expect(authorized.payload.errors).toBeUndefined();
      expect(authorized.payload.data).toMatchObject({
        account: { profile: { id: firstUserId } },
        viewer: {
          todos: { pageInfo: { total: 1 } },
        },
      });

      const todoOnly = await signToken(firstUserId, [
        restReadScope("workspace.todo"),
      ]);
      const missing = await execute(
        {
          query: /* GraphQL */ `
          {
            account {
              profile {
                id
              }
            }
          }
        `,
        },
        { authorization: `Bearer ${todoOnly}` },
      );
      expect(missing.response.status).toBe(403);
      expect(missing.payload.errors?.[0]?.extensions).toMatchObject({
        code: "FORBIDDEN",
        requiredScopes: [restReadScope("account.profile")],
      });

      const twoScopes = await signToken(firstUserId, [
        restReadScope("workspace.todo"),
        restReadScope("workspace.subscription"),
      ]);
      const multiField = await execute(
        {
          query: /* GraphQL */ `
          {
            viewer: workspace {
              todos {
                pageInfo {
                  total
                }
              }
              subscribedSections {
                pageInfo {
                  total
                }
              }
              homeworks {
                pageInfo {
                  total
                }
              }
            }
          }
        `,
        },
        { authorization: `Bearer ${twoScopes}` },
      );
      expect(multiField.response.status).toBe(403);
      expect(multiField.payload.errors?.[0]?.extensions).toMatchObject({
        code: "FORBIDDEN",
        requiredScopes: [restReadScope("workspace.homework")],
      });
    });
  });
});
