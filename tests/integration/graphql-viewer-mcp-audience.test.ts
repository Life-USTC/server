import { describe, expect } from "vitest";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
} from "@/lib/oauth/resource-urls";
import { restReadScope } from "@/lib/oauth/scope-registry";
import { graphqlViewerTest as it } from "../shared/graphql-viewer-fixture";

describe("GraphQL Viewer integration", () => {
  it("rejects a MCP bearer without falling back to a valid session cookie", async ({
    viewer: viewerCase,
  }) => {
    await viewerCase.run(async () => {
      const { signToken, firstUserId, execute, sessionCookie } = viewerCase;
      const resource = getOAuthMcpResourceUrl;
      const wrongAudience = await signToken(
        firstUserId,
        [restReadScope("account.profile")],
        resource(),
      );
      const { response, payload } = await execute(
        { query: "{ account { profile { id } } }" },
        {
          authorization: `Bearer ${wrongAudience}`,
          cookie: sessionCookie,
          origin: new URL(getOAuthGraphqlResourceUrl()).origin,
        },
      );

      expect(response.status).toBe(401);
      expect(payload.errors?.[0]?.extensions).toMatchObject({
        code: "UNAUTHENTICATED",
      });
      expect(payload.data?.account).not.toMatchObject({
        profile: { id: firstUserId },
      });
    });
  });
});
