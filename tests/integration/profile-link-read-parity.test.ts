import type { RequestEvent } from "@sveltejs/kit";
import { expect } from "vitest";
import { getCommunityUserRoute } from "@/lib/api/routes/public-user-profile";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { mcpProtocolTest as it } from "../shared/mcp-protocol-fixture";

// A single native case owns this isolated file's GraphQL/auth module state.
// This does not claim arbitrary case concurrency in a shared module environment.
it("interface-hierarchy.public-profile-read-parity", async ({
  isolatedDatabase: { owner: db },
  protocolRuntime,
  mcpSessions,
}) => {
  await protocolRuntime.run(async () => {
    const handler = createGraphqlRequestHandler(false);
    const marker = crypto.randomUUID();
    const username = `u${marker.replaceAll("-", "").slice(0, 14)}`;
    const owner = await db.user.create({
      data: {
        id: marker,
        email: `${marker}@profile-read.test`,
        username,
        name: "Public profile identity",
        image: "https://example.test/avatar.png",
        createdAt: new Date("2026-01-01T00:00:00.437Z"),
        isAdmin: true,
      },
    });
    const native = await mcpSessions.createAnonymousMcpHarness();
    for (const identifier of [
      username,
      username.toUpperCase(),
      `  ${owner.username}  `,
      owner.id,
      ` ${owner.id} `,
      `missing-${marker}`,
    ]) {
      const restResponse = await protocolRuntime.request(() =>
        getCommunityUserRoute(identifier),
      );
      const rest = await restResponse.json();
      const mcp = await native.call<{
        found: boolean;
        user?: Record<string, unknown>;
      }>("community_user_get", { identifier, mode: "full" });
      const response = await protocolRuntime.request(() =>
        handler({
          request: new Request("http://localhost:3000/api/graphql", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              query:
                "query($identifier: String!) { community { user(identifier: $identifier) { id username name image createdAt } } }",
              variables: { identifier },
            }),
          }),
          locals: { authUser: null, locale: "en-us", requestId: marker },
        } as unknown as RequestEvent),
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.errors).toBeUndefined();
      if (identifier.startsWith("missing-")) {
        expect(restResponse.status).toBe(404);
        expect(mcp.found).toBe(false);
        expect(body.data.community.user).toBeNull();
        continue;
      }
      expect(restResponse.status).toBe(200);
      expect(mcp).toEqual({ success: true, found: true, ...rest });
      const identity = {
        id: owner.id,
        username: owner.username,
        name: owner.name,
        image: owner.image,
      };
      expect(rest.user).toMatchObject(identity);
      expect(new Date(rest.user.createdAt).getTime()).toBe(
        owner.createdAt.getTime(),
      );
      const gql = body.data.community.user;
      expect(gql).toMatchObject(identity);
      expect(new Date(gql.createdAt).getTime()).toBe(owner.createdAt.getTime());
      expect(Object.keys(gql).sort()).toEqual([
        "createdAt",
        "id",
        "image",
        "name",
        "username",
      ]);
      expect(rest.user._count).toEqual({
        comments: 0,
        homeworksCreated: 0,
        uploads: 0,
      });
      expect(rest.totalContributions).toBe(0);
      expect(rest.weeks.length).toBeGreaterThan(0);
      for (const payload of [rest, mcp, gql]) {
        expect(JSON.stringify(payload)).not.toContain(owner.email);
        expect(JSON.stringify(payload)).not.toContain('"isAdmin"');
      }
    }
  });
});
