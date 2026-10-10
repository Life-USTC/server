import type { RequestEvent } from "@sveltejs/kit";
import { expect, vi } from "vitest";
import { getCommunityUserRoute } from "@/lib/api/routes/public-user-profile";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { mcpProtocolTest as it } from "../shared/mcp-protocol-fixture";

// Each native case owns its clock and private runtime; file execution remains serial.
for (const method of ["REST", "GraphQL", "MCP"] as const) {
  it(`interface-hierarchy.public-profile-read / ${method}`, {
    tags: [`@User/${method}`],
  }, async ({
    isolatedDatabase: { owner: db },
    protocolRuntime,
    mcpSessions,
    onTestFinished,
  }) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T04:00:00Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });
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
      const identity = {
        id: owner.id,
        username: owner.username,
        name: owner.name,
        image: owner.image,
        createdAt: owner.createdAt.toISOString(),
      };
      // Explicit empty contribution calendar: Sunday 2025-10-05 to Saturday 2026-10-10.
      const dates = Array.from({ length: 371 }, (_, day) => ({
        date: new Date(Date.UTC(2025, 9, 5 + day)).toISOString().slice(0, 10),
        count: 0,
      }));
      const weeks = Array.from({ length: 53 }, (_, week) =>
        dates.slice(week * 7, week * 7 + 7),
      );
      const profile = {
        user: {
          ...identity,
          _count: { comments: 0, homeworksCreated: 0, uploads: 0 },
        },
        weeks,
        totalContributions: 0,
      };
      const native =
        method === "MCP"
          ? await mcpSessions.createAnonymousMcpHarness()
          : undefined;
      for (const identifier of [
        username,
        username.toUpperCase(),
        `  ${owner.username}  `,
        owner.id,
        ` ${owner.id} `,
        `missing-${marker}`,
      ]) {
        const missing = identifier.startsWith("missing-");
        let payload: unknown;
        if (method === "REST") {
          const response = await protocolRuntime.request(() =>
            getCommunityUserRoute(identifier),
          );
          payload = await response.json();
          expect(response.status).toBe(missing ? 404 : 200);
          if (!missing) expect(payload).toEqual(profile);
        } else if (method === "GraphQL") {
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
          payload = body.data.community.user;
          expect(payload).toEqual(missing ? null : identity);
          if (!missing)
            expect(Object.keys(payload as object).sort()).toEqual([
              "createdAt",
              "id",
              "image",
              "name",
              "username",
            ]);
        } else {
          if (!native) throw new Error("MCP case requires its owned session");
          const mcp = await native.call<{
            found: boolean;
            user?: Record<string, unknown>;
          }>("community_user_get", { identifier, mode: "full" });
          payload = mcp;
          expect(mcp.found).toBe(!missing);
          if (!missing)
            expect(mcp).toEqual({ success: true, found: true, ...profile });
        }
        expect(JSON.stringify(payload)).not.toContain(owner.email);
        expect(JSON.stringify(payload)).not.toContain('"isAdmin"');
      }
    });
  });
}
