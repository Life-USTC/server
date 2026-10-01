import { expect, type Page } from "@playwright/test";
import type { CalendarProtocol } from "../../../../utils/calendar-protocol-lifecycle";
import { test } from "../../../../utils/private-calendar-fixture";
import { type OAuthOwner, parseTextContent } from "../../api/mcp/helpers";
import { memberships, prepareContract } from "./_contract";

async function prepare(
  page: Page,
  owner: OAuthOwner,
  io: CalendarProtocol,
  semesterId: number,
  messages: number,
) {
  const db = owner.worker.database.owner;
  const marker = crypto.randomUUID().slice(0, 8);
  const fixture = await db.$transaction(async (tx) => {
    const base = 1_700_000_000 + Math.floor(Math.random() * 10_000_000);
    const course = await tx.course.create({
      data: {
        jwId: base,
        code: `BOUND${marker}`,
        nameCn: `订阅边界 ${marker}`,
        nameEn: `Subscription bounds ${marker}`,
      },
    });
    await tx.section.createMany({
      data: Array.from({ length: 500 }, (_, i) => ({
        jwId: base + i + 1,
        code: `${course.code}.${String(i + 1).padStart(3, "0")}`,
        courseId: course.id,
        semesterId,
      })),
    });
    const sections = await tx.section.findMany({
      where: { courseId: course.id },
      orderBy: { id: "asc" },
    });
    const username = `sub-bound-${marker}`;
    const user = await tx.user.create({
      data: {
        id: crypto.randomUUID(),
        username,
        name: username,
        email: `${username}@example.test`,
        emailVerified: true,
      },
    });
    return { course, sections, user, semesterId };
  });
  const userId = fixture.user.id;
  const contract = await prepareContract(page, owner, io, [userId], messages);
  return {
    db,
    fixture,
    userId,
    contract,
    ids: fixture.sections.map(({ id }) => id),
    codes: fixture.sections.map(({ code }) => code),
  };
}

test("subscription.bounded-batch-input REST query append remove", async ({
  page,
  oauthOwner,
  calendarProtocolRun,
  calendarSemester,
}) => {
  test.setTimeout(180_000);
  await calendarProtocolRun(async (io) => {
    const { db, fixture, userId, contract, ids, codes } = await prepare(
      page,
      oauthOwner,
      io,
      calendarSemester,
      2,
    );
    const oversizeIds = [...ids, ids[0]];
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
      await oversized.body();
      expect(oversized.status()).toBe(400);
    }
    expect(await memberships(db, userId)).toHaveLength(0);
    const appended = await page.request.patch("/api/workspace/subscriptions", {
      data: { sectionIds: ids },
    });
    expect(appended.status()).toBe(200);
    expect((await appended.json()).addedCount).toBe(500);
    const baseline = await memberships(db, userId);
    expect(baseline).toHaveLength(500);
    for (const method of ["patch", "delete"] as const) {
      const oversized = await page.request[method](
        "/api/workspace/subscriptions",
        {
          data: { sectionIds: oversizeIds },
        },
      );
      await oversized.body();
      expect(oversized.status()).toBe(400);
      expect(await memberships(db, userId)).toEqual(baseline);
    }
    const removed = await page.request.delete("/api/workspace/subscriptions", {
      data: { sectionIds: ids },
    });
    await removed.body();
    expect(removed.status()).toBe(200);
    expect(await memberships(db, userId)).toHaveLength(0);

    return contract.checks(
      [],
      [
        ["POST", "/api/workspace/subscriptions/query", [200, 400, 200, 400]],
        ["PATCH", "/api/workspace/subscriptions", [200, 400]],
        ["DELETE", "/api/workspace/subscriptions", [400, 200]],
      ],
    );
  });
});

test("subscription.bounded-batch-input REST batch", async ({
  page,
  oauthOwner,
  calendarProtocolRun,
  calendarSemester,
}) => {
  test.setTimeout(180_000);
  await calendarProtocolRun(async (io) => {
    const { db, fixture, userId, contract, ids, codes } = await prepare(
      page,
      oauthOwner,
      io,
      calendarSemester,
      4,
    );
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
        const beforeOversize = await memberships(db, userId);
        const oversized = await page.request.post(
          "/api/workspace/subscriptions/batch",
          {
            data: {
              action,
              [field]: [...values, values[0]],
              semesterId: fixture.semesterId,
            },
          },
        );
        await oversized.body();
        expect(oversized.status()).toBe(400);
        expect(await memberships(db, userId)).toEqual(beforeOversize);
      }
    }

    return contract.checks(
      [],
      [
        [
          "POST",
          "/api/workspace/subscriptions/batch",
          [200, 400, 200, 400, 200, 400, 200, 400],
        ],
      ],
    );
  });
});

test("subscription.bounded-batch-input REST import", async ({
  page,
  oauthOwner,
  calendarProtocolRun,
  calendarSemester,
}) => {
  test.setTimeout(180_000);
  await calendarProtocolRun(async (io) => {
    const { db, fixture, userId, contract, ids, codes } = await prepare(
      page,
      oauthOwner,
      io,
      calendarSemester,
      1,
    );
    const oversizeCodes = [...codes, codes[0]];
    const imported = await page.request.post(
      "/api/workspace/subscriptions/import-codes",
      { data: { codes, semesterId: fixture.semesterId } },
    );
    expect(imported.status()).toBe(200);
    expect((await imported.json()).addedCount).toBe(500);
    const restImportState = await memberships(db, userId);
    const oversized = await page.request.post(
      "/api/workspace/subscriptions/import-codes",
      {
        data: { codes: oversizeCodes, semesterId: fixture.semesterId },
      },
    );
    await oversized.body();
    expect(oversized.status()).toBe(400);
    expect(await memberships(db, userId)).toEqual(restImportState);

    return contract.checks(ids, [
      ["POST", "/api/workspace/subscriptions/import-codes", [200, 400]],
    ]);
  });
});

test("subscription.bounded-batch-input GraphQL import", async ({
  page,
  oauthOwner,
  calendarProtocolRun,
  calendarSemester,
  isolatedWorker,
}) => {
  test.setTimeout(180_000);
  await calendarProtocolRun(async (io) => {
    const { db, fixture, userId, contract, ids, codes } = await prepare(
      page,
      oauthOwner,
      io,
      calendarSemester,
      1,
    );
    const oversizeCodes = [...codes, codes[0]];
    const mutation =
      "mutation($input: UpdateSectionSubscriptionsInput!) { subscriptionsImport(input: $input) { addedCount } }";
    const gql = async (values: string[]) =>
      (
        await page.request.post("/api/graphql", {
          headers: { origin: isolatedWorker.origin },
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
    const gqlState = await memberships(db, userId);
    expect((await gql(oversizeCodes)).errors[0].extensions.code).toBe(
      "BAD_USER_INPUT",
    );
    expect(await memberships(db, userId)).toEqual(gqlState);

    return contract.checks(ids, [["POST", "/api/graphql", [200, 400]]]);
  });
});

test("subscription.bounded-batch-input MCP import", async ({
  page,
  oauthOwner,
  calendarProtocolRun,
  calendarSemester,
}) => {
  test.setTimeout(180_000);
  await calendarProtocolRun(async (io) => {
    const { db, fixture, userId, contract, ids, codes } = await prepare(
      page,
      oauthOwner,
      io,
      calendarSemester,
      1,
    );
    const call = await contract.authorizeImports("subscription-bounds");
    const result = await call(codes, fixture.semesterId);
    expect(result.isError).not.toBe(true);
    expect(parseTextContent(result).addedCount).toBe(500);
    const mcpState = await memberships(db, userId);
    const rejected = await call([...codes, codes[0]], fixture.semesterId, true);
    expect(rejected.isError).toBe(true);
    expect(await memberships(db, userId)).toEqual(mcpState);
    return contract.checks(ids, [], 2, 1);
  });
});
