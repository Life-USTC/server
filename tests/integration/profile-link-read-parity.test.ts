import type { RequestEvent } from "@sveltejs/kit";
import { makeSignature } from "better-auth/crypto";
import { afterAll, expect, it } from "vitest";
import { USTC_CATALOG_LINKS } from "@/features/catalog-links/lib/catalog-links";
import { getSignedInCatalogLinksData } from "@/features/catalog-links/server/catalog-link-data";
import { updateWorkspaceLinkPinState } from "@/features/catalog-links/server/catalog-link-service";
import { getCommunityUserRoute } from "@/lib/api/routes/public-user-profile";
import { getWorkspaceLinkPinsRoute } from "@/lib/api/routes/workspace-link-pin-route";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { createFixturePrisma } from "../shared/prisma";
import {
  createAnonymousMcpHarness,
  createMcpHarness,
} from "./mcp/_harness/client";

const db = createFixturePrisma();
const handler = createGraphqlRequestHandler(false);
afterAll(() => db.$disconnect());

it("interface-hierarchy.public-profile-read-parity", async () => {
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
  const native = await createAnonymousMcpHarness();
  try {
    for (const identifier of [
      username,
      username.toUpperCase(),
      `  ${owner.username}  `,
      owner.id,
      ` ${owner.id} `,
      `missing-${marker}`,
    ]) {
      const restResponse = await getCommunityUserRoute(identifier);
      const rest = await restResponse.json();
      const mcp = await native.call<{
        found: boolean;
        user?: Record<string, unknown>;
      }>("community_user_get", { identifier, mode: "full" });
      const response = await handler({
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
      } as unknown as RequestEvent);
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
  } finally {
    await native.close();
    await db.user.delete({ where: { id: owner.id } });
  }
});

it("interface-hierarchy.link-pin-read-parity", async () => {
  const owners: { id: string; cookie: string }[] = [];
  const slugs = USTC_CATALOG_LINKS.slice(0, 6)
    .map((row) => row.slug)
    .sort();
  try {
    for (let index = 0; index < 3; index++) {
      const owner = await db.user.create({
        data: { email: `${crypto.randomUUID()}@pin-read.test` },
      });
      const token = crypto.randomUUID();
      await db.session.create({
        data: {
          userId: owner.id,
          sessionToken: token,
          expires: new Date(Date.now() + 3600000),
        },
      });
      const context = await getBetterAuthInstance().$context;
      owners.push({
        id: owner.id,
        cookie: `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`,
      });
    }
    const expected = [slugs.slice(0, 4), [slugs[5]], []];
    for (let index = 0; index < owners.length; index++)
      for (const slug of [...expected[index]].reverse())
        await db.workspaceLinkPin.create({
          data: {
            userId: owners[index].id,
            slug,
            createdAt: new Date("2025-01-01T00:00:00.437Z"),
          },
        });
    for (let index = 0; index < owners.length; index++) {
      const owner = owners[index];
      const mcp = await createMcpHarness(owner.id, ["workspace.link-pin:read"]);
      try {
        const response = await getWorkspaceLinkPinsRoute(
          new Request(
            `http://localhost:3000/api/workspace/link-pins?userId=${owners[(index + 1) % 3].id}`,
            { headers: { cookie: owner.cookie } },
          ),
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          pinnedSlugs: expected[index],
          maxPinnedLinks: 4,
          error: null,
        });
        expect(
          await mcp.call("workspace_link_pin_list", { mode: "full" }),
        ).toEqual({
          success: true,
          pinnedSlugs: expected[index],
          maxPinnedLinks: 4,
        });
        for (const locale of ["zh-cn", "en-us"] as const) {
          const pageData = await getSignedInCatalogLinksData(owner.id, locale);
          expect(pageData.pinnedLinks.map((row) => row.slug)).toEqual(
            expected[index],
          );
          expect(
            pageData.overviewLinks
              .slice(0, expected[index].length)
              .map((row) => row.slug),
          ).toEqual(expected[index]);
        }
      } finally {
        await mcp.close();
      }
    }
    // The same stable oldest-first order decides overflow and mutation results.
    expect(
      await updateWorkspaceLinkPinState({
        userId: owners[0].id,
        slug: slugs[4],
        action: "pin",
      }),
    ).toEqual([...slugs.slice(1, 4), slugs[4]]);
    expect(
      await updateWorkspaceLinkPinState({
        userId: owners[0].id,
        slug: slugs[2],
        action: "unpin",
      }),
    ).toEqual([slugs[1], slugs[3], slugs[4]]);
  } finally {
    await db.user.deleteMany({
      where: { id: { in: owners.map((row) => row.id) } },
    });
  }
});
