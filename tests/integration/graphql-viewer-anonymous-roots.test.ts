import { describe, expect } from "vitest";
import { graphqlViewerTest as it } from "../shared/graphql-viewer-fixture";

describe("GraphQL Viewer integration", () => {
  it("graphql.anonymous-roots", { tags: ["@GraphQL/GraphQL"] }, async ({
    viewerTransport,
  }) => {
    await viewerTransport.run(async () => {
      const { execute } = viewerTransport;
      const { response, payload } = await execute({
        query:
          "{ account { profile { id } } workspace { todos { pageInfo { total } } } catalog { __typename } community { __typename } }",
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(payload).toEqual({
        data: {
          account: null,
          workspace: null,
          catalog: { __typename: "Catalog" },
          community: { __typename: "Community" },
        },
      });
    });
  });
});
