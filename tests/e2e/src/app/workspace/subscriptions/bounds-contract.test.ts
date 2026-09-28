import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";
import { issueAccessToken, parseTextContent } from "../../api/mcp/helpers";

test("subscription.bounded-batch-input", async ({ page, request }) => {
  test.setTimeout(180_000);
  const marker = crypto.randomUUID().slice(0, 8);
  const fixture = await withE2ePrisma(async (db) => {
    const seed = await db.section.findUniqueOrThrow({
      where: { jwId: DEV_SEED.section.jwId },
    });
    const base = 1_700_000_000 + Math.floor(Math.random() * 10_000_000);
    const course = await db.course.create({
      data: {
        jwId: base,
        code: `BOUND${marker}`,
        nameCn: `订阅边界 ${marker}`,
        nameEn: `Subscription bounds ${marker}`,
      },
    });
    await db.section.createMany({
      data: Array.from({ length: 500 }, (_, i) => ({
        jwId: base + i + 1,
        code: `${course.code}.${String(i + 1).padStart(3, "0")}`,
        courseId: course.id,
        semesterId: seed.semesterId,
      })),
    });
    const sections = await db.section.findMany({
      where: { courseId: course.id },
      orderBy: { id: "asc" },
    });
    const users = [];
    for (let i = 0; i < 5; i++) {
      const username = `sub-bound-${marker}-${i}`;
      users.push(
        await db.user.create({
          data: {
            username,
            name: username,
            email: `${username}@example.test`,
            emailVerified: true,
          },
        }),
      );
    }
    return { course, sections, users, semesterId: seed.semesterId };
  });
  let clientId: string | undefined;
  const ids = fixture.sections.map(({ id }) => id);
  const codes = fixture.sections.map(({ code }) => code);
  const oversizeIds = [...ids, ids[0]];
  const oversizeCodes = [...codes, codes[0]];
  async function owner(index: number) {
    await page.context().clearCookies();
    await page
      .context()
      .addCookies([await createSignedSessionCookie(fixture.users[index].id)]);
  }
  async function memberships(index: number) {
    return withE2ePrisma((db) =>
      db.userSectionSubscription.findMany({
        where: { userId: fixture.users[index].id },
        orderBy: { sectionId: "asc" },
      }),
    );
  }
  try {
    await owner(0);
    for (const field of ["sectionIds", "codes"] as const) {
      const values = field === "sectionIds" ? ids : codes;
      const query = await page.request.post(
        "/api/workspace/subscriptions/query",
        { data: { [field]: values, semesterId: fixture.semesterId } },
      );
      expect(query.status()).toBe(200);
      expect((await query.json()).sections).toHaveLength(500);
      const oversized = await page.request.post(
        "/api/workspace/subscriptions/query",
        {
          data: {
            [field]: [...values, values[0]],
            semesterId: fixture.semesterId,
          },
        },
      );
      expect(oversized.status()).toBe(400);
    }
    expect(await memberships(0)).toHaveLength(0);
    const appended = await page.request.patch("/api/workspace/subscriptions", {
      data: { sectionIds: ids },
    });
    expect(appended.status()).toBe(200);
    expect((await appended.json()).addedCount).toBe(500);
    const baseline = await memberships(0);
    expect(baseline).toHaveLength(500);
    for (const method of ["patch", "delete"] as const) {
      expect(
        (
          await page.request[method]("/api/workspace/subscriptions", {
            data: { sectionIds: oversizeIds },
          })
        ).status(),
      ).toBe(400);
      expect(await memberships(0)).toEqual(baseline);
    }
    expect(
      (
        await page.request.delete("/api/workspace/subscriptions", {
          data: { sectionIds: ids },
        })
      ).status(),
    ).toBe(200);
    expect(await memberships(0)).toHaveLength(0);

    await owner(1);
    for (const field of ["sectionIds", "codes"] as const) {
      const values = field === "sectionIds" ? ids : codes;
      for (const action of ["add", "remove"]) {
        const result = await page.request.post(
          "/api/workspace/subscriptions/batch",
          { data: { action, [field]: values, semesterId: fixture.semesterId } },
        );
        expect(result.status()).toBe(200);
        expect(
          (await result.json())[
            action === "add" ? "addedCount" : "removedCount"
          ],
        ).toBe(500);
        const beforeOversize = await memberships(1);
        expect(
          (
            await page.request.post("/api/workspace/subscriptions/batch", {
              data: {
                action,
                [field]: [...values, values[0]],
                semesterId: fixture.semesterId,
              },
            })
          ).status(),
        ).toBe(400);
        expect(await memberships(1)).toEqual(beforeOversize);
      }
    }

    await owner(2);
    const imported = await page.request.post(
      "/api/workspace/subscriptions/import-codes",
      { data: { codes, semesterId: fixture.semesterId } },
    );
    expect(imported.status()).toBe(200);
    expect((await imported.json()).addedCount).toBe(500);
    const restImportState = await memberships(2);
    expect(
      (
        await page.request.post("/api/workspace/subscriptions/import-codes", {
          data: { codes: oversizeCodes, semesterId: fixture.semesterId },
        })
      ).status(),
    ).toBe(400);
    expect(await memberships(2)).toEqual(restImportState);

    await owner(3);
    const mutation =
      "mutation($input: UpdateSectionSubscriptionsInput!) { subscriptionsImport(input: $input) { addedCount } }";
    const gql = async (values: string[]) =>
      (
        await page.request.post("/api/graphql", {
          headers: { origin: PLAYWRIGHT_BASE_URL },
          data: {
            query: mutation,
            variables: {
              input: {
                action: "ADD",
                codes: values,
                semesterId: fixture.semesterId,
              },
            },
          },
        })
      ).json();
    const gqlImport = await gql(codes);
    expect(gqlImport.errors).toBeUndefined();
    expect(gqlImport.data.subscriptionsImport.addedCount).toBe(500);
    const gqlState = await memberships(3);
    expect((await gql(oversizeCodes)).errors[0].extensions.code).toBe(
      "BAD_USER_INPUT",
    );
    expect(await memberships(3)).toEqual(gqlState);

    await owner(4);
    const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
    const scope = "workspace.subscription:write";
    const token = await issueAccessToken(page, request, {
      resource,
      scope,
      clientScopes: [scope],
    });
    clientId = token.clientId;
    const client = new Client({ name: "subscription-bounds", version: "1" });
    try {
      await client.connect(
        new StreamableHTTPClientTransport(new URL(resource), {
          requestInit: {
            headers: { Authorization: `Bearer ${token.accessToken}` },
          },
        }),
      );
      const result = await client.callTool({
        name: "workspace_subscription_import",
        arguments: { codes, semesterId: fixture.semesterId },
      });
      expect(result.isError).not.toBe(true);
      expect(parseTextContent(result).addedCount).toBe(500);
      const mcpState = await memberships(4);
      const rejected = await client.callTool({
        name: "workspace_subscription_import",
        arguments: { codes: oversizeCodes, semesterId: fixture.semesterId },
      });
      expect(rejected.isError).toBe(true);
      expect(await memberships(4)).toEqual(mcpState);
    } finally {
      await client.close();
    }
  } finally {
    await withE2ePrisma(async (db) => {
      if (clientId) await db.oAuthClient.delete({ where: { clientId } });
      const userIds = fixture.users.map(({ id }) => id);
      await db.auditLog.deleteMany({ where: { userId: { in: userIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await db.section.deleteMany({ where: { courseId: fixture.course.id } });
      await db.course.delete({ where: { id: fixture.course.id } });
    });
  }
});
