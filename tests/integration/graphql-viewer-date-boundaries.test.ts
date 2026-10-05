import { describe, expect } from "vitest";
import { graphqlViewerTest as it } from "../shared/graphql-viewer-fixture";

describe("GraphQL Viewer integration", () => {
  it("enforces default/max pagination, ordered ranges, and strict zoned dates", {
    tags: ["@GraphQL/GraphQL"],
  }, async ({ viewer: viewerCase }) => {
    await viewerCase.run(async () => {
      const { execute, graphqlBearer } = viewerCase;
      const headers = { authorization: `Bearer ${graphqlBearer}` };
      const accepted = await execute(
        {
          query: /* GraphQL */ `
          {
            viewer: workspace {
              defaultPage: todos {
                pageInfo {
                  page
                  pageSize
                }
              }
              maxPage: todos(page: { pageSize: 100 }) {
                pageInfo {
                  pageSize
                }
              }
            }
          }
        `,
        },
        headers,
      );
      expect(accepted.payload.errors).toBeUndefined();
      expect(accepted.payload.data?.viewer).toMatchObject({
        defaultPage: { pageInfo: { page: 1, pageSize: 20 } },
        maxPage: { pageInfo: { pageSize: 100 } },
      });

      const oversized = await execute(
        {
          query:
            "{ viewer: workspace { todos(page: { pageSize: 101 }) { pageInfo { total } } } }",
        },
        headers,
      );
      expect(oversized.payload.errors?.[0]?.extensions).toMatchObject({
        code: "BAD_USER_INPUT",
      });

      const inverted = await execute(
        {
          query: /* GraphQL */ `
          {
            viewer: workspace {
              schedules(
                filter: {
                  dateFrom: "2026-04-30T00:00:00+08:00"
                  dateTo: "2026-04-29T00:00:00+08:00"
                }
              ) {
                pageInfo {
                  total
                }
              }
            }
          }
        `,
        },
        headers,
      );
      expect(inverted.payload.errors?.[0]?.extensions).toMatchObject({
        code: "BAD_USER_INPUT",
      });

      const timezoneMissing = await execute(
        {
          query: /* GraphQL */ `
          {
            viewer: workspace {
              schedules(filter: { dateFrom: "2026-04-29T00:00:00" }) {
                pageInfo {
                  total
                }
              }
            }
          }
        `,
        },
        headers,
      );
      expect(timezoneMissing.payload.errors?.[0]?.extensions).toMatchObject({
        code: "BAD_USER_INPUT",
      });
    });
  });
});
