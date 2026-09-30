import { makeSignature } from "better-auth/crypto";
import { expect } from "vitest";
import { USTC_CATALOG_LINKS } from "@/features/catalog-links/lib/catalog-links";
import { getSignedInCatalogLinksData } from "@/features/catalog-links/server/catalog-link-data";
import { updateWorkspaceLinkPinState } from "@/features/catalog-links/server/catalog-link-service";
import { getWorkspaceLinkPinsRoute } from "@/lib/api/routes/workspace-link-pin-route";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { isolatedMcpTest as it } from "./mcp/_harness/isolated-context";

// The real Better Auth singleton belongs to this one-case isolated runner file.
// It is not shared across private databases or safe for same-realm concurrency.
it("interface-hierarchy.link-pin-read-parity", async ({
  isolatedDatabase: { owner: db },
  mcpRuntime,
  mcpSessions,
}) => {
  await mcpRuntime.run(async () => {
    const owners: { id: string; cookie: string }[] = [];
    const slugs = USTC_CATALOG_LINKS.slice(0, 6)
      .map((row) => row.slug)
      .sort();
    const expected = [slugs.slice(0, 4), [slugs[5]], []];
    const records = await db.$transaction(async (tx) => {
      const records: { id: string; token: string }[] = [];
      for (let index = 0; index < 3; index++) {
        const owner = await tx.user.create({
          data: { email: `${crypto.randomUUID()}@pin-read.test` },
        });
        const token = crypto.randomUUID();
        await tx.session.create({
          data: {
            userId: owner.id,
            sessionToken: token,
            expires: new Date(Date.now() + 3600000),
          },
        });
        records.push({ id: owner.id, token });
        for (const slug of [...expected[index]].reverse())
          await tx.workspaceLinkPin.create({
            data: {
              userId: owner.id,
              slug,
              createdAt: new Date("2025-01-01T00:00:00.437Z"),
            },
          });
      }
      return records;
    });
    const context = await getBetterAuthInstance().$context;
    for (const { id, token } of records)
      owners.push({
        id,
        cookie: `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`,
      });
    for (let index = 0; index < owners.length; index++) {
      const owner = owners[index];
      const owned = mcpSessions.own(owner.id, ["workspace.link-pin:read"]);
      await owned.initialize();
      const mcp = owned.client;
      const response = await mcpRuntime.run(() =>
        getWorkspaceLinkPinsRoute(
          new Request(
            `https://life.example/api/workspace/link-pins?userId=${owners[(index + 1) % 3].id}`,
            { headers: { cookie: owner.cookie } },
          ),
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
  });
});
