import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect } from "@playwright/test";
import { test as calendarTest } from "../../../../utils/private-calendar-fixture";
import {
  issueAccessTokenForClient,
  parseTextContent,
  registerPublicClient,
} from "../../api/mcp/helpers";

const base = "/api/workspace/subscriptions";
const test = calendarTest.extend<{
  second: { id: number; code: string };
  failSecondRow: (operation: "INSERT" | "DELETE") => Promise<void>;
}>({
  second: async ({ calendar, page, isolatedWorker }, use) => {
    const db = isolatedWorker.database.owner;
    const second = await db.$transaction(async (tx) => {
      await tx.userSectionSubscription.deleteMany({
        where: { userId: calendar.users[0].id },
      });
      return tx.section.create({
        data: {
          jwId: calendar.section.jwId + 10000,
          code: `${calendar.course.code}.02`,
          courseId: calendar.course.id,
          semesterId: calendar.section.semesterId,
        },
      });
    });
    await page
      .context()
      .addCookies([
        (await isolatedWorker.createSession(calendar.users[0].id)).cookie,
      ]);
    await use(second);
  },
  failSecondRow: async ({ calendar, second, isolatedWorker }, use) => {
    const db = isolatedWorker.database.owner;
    const trigger = `subscription_failure_${crypto.randomUUID().replaceAll("-", "")}`;
    const ownerId = calendar.users[0].id;
    if (!/^[a-zA-Z0-9_-]+$/.test(ownerId))
      throw new Error("Unexpected fixture ID");
    try {
      await use(async (operation) => {
        const row = operation === "DELETE" ? "OLD" : "NEW";
        // The trigger is restricted to this test's owner and section.
        await db.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF ${row}."userId" = '${ownerId}' AND ${row}."sectionId" = ${second.id} THEN RAISE EXCEPTION 'isolated subscription failure'; END IF; RETURN ${row}; END; $body$`,
          );
          await tx.$executeRawUnsafe(
            `CREATE TRIGGER "${trigger}" BEFORE ${operation} ON "UserSectionSubscription" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
          );
        });
      });
    } finally {
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP TRIGGER IF EXISTS "${trigger}" ON "UserSectionSubscription"`,
        );
        await tx.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
      });
    }
  },
});

function memberships(
  db: import("../../../../utils/isolated-worker").IsolatedWorker["database"]["owner"],
  userId: string,
) {
  return db.userSectionSubscription.findMany({
    where: { userId },
    orderBy: { sectionId: "asc" },
  });
}

for (const operation of [
  "append",
  "remove",
  "query",
  "batch",
  "import-codes",
] as const) {
  test(`subscription.duplicate-input-semantics REST ${operation}`, async ({
    page,
    calendar: fixture,
    second: _second,
    isolatedWorker,
  }) => {
    const db = isolatedWorker.database.owner;
    const id = fixture.section.id;
    const code = fixture.section.code;
    const codes = [code, code.toLowerCase(), ` ${code} `];
    const userId = fixture.users[0].id;
    if (operation === "remove")
      await db.userSectionSubscription.create({
        data: { userId, sectionId: id },
      });
    const send = () => {
      if (operation === "append")
        return page.request.patch(base, { data: { sectionIds: [id, id] } });
      if (operation === "remove")
        return page.request.delete(base, { data: { sectionIds: [id, id] } });
      return page.request.post(`${base}/${operation}`, {
        data: {
          codes,
          semesterId: fixture.section.semesterId,
          ...(operation === "import-codes" ? {} : { sectionIds: [id, id] }),
          ...(operation === "batch" ? { action: "add" } : {}),
        },
      });
    };
    const response = await send();
    expect(response.status()).toBe(200);
    const body = await response.json();
    if (operation === "query" || operation === "batch")
      expect(body).toMatchObject({
        total: 1,
        matchedSectionIds: [id],
        matchedCodes: [code],
      });
    if (operation === "import-codes")
      expect(body).toMatchObject({ addedCount: 1, matchedCodes: [code] });
    if (operation === "append")
      expect(body).toMatchObject({ addedCount: 1, alreadySubscribedCount: 0 });
    if (operation === "batch") expect(body.addedCount).toBe(1);
    const added = await memberships(db, userId);
    expect(added.map(({ sectionId }) => sectionId)).toEqual(
      operation === "query" || operation === "remove" ? [] : [id],
    );
    const replay = await send();
    expect(replay.status()).toBe(200);
    if (operation === "batch")
      expect(await replay.json()).toMatchObject({
        addedCount: 0,
        total: 1,
        matchedSectionIds: [id],
        matchedCodes: [code],
      });
    if (operation === "append" || operation === "import-codes")
      expect(await replay.json()).toMatchObject({
        addedCount: 0,
        alreadySubscribedCount: 1,
      });
    expect(await memberships(db, userId)).toEqual(added);
  });
}

test("subscription.duplicate-input-semantics GraphQL", async ({
  page,
  calendar: fixture,
  second: _second,
  isolatedWorker,
}) => {
  const db = isolatedWorker.database.owner;
  const code = fixture.section.code;
  const gql = async (codes: string[], action = "ADD", status = 200) => {
    const response = await page.request.post("/api/graphql", {
      headers: { origin: isolatedWorker.origin },
      data: {
        query:
          "mutation($input: UpdateSectionSubscriptionsInput!) { subscriptionsImport(input: $input) { addedCount removedCount } }",
        variables: {
          input: { action, codes, semesterId: fixture.section.semesterId },
        },
      },
    });
    expect(response.status()).toBe(status);
    return response.json();
  };
  const before = await memberships(db, fixture.users[0].id);
  expect(
    (await gql([code, code.toLowerCase(), ` ${code} `], "ADD", 400)).errors[0]
      .extensions.code,
  ).toBe("BAD_USER_INPUT");
  expect(await memberships(db, fixture.users[0].id)).toEqual(before);
  const single = await gql([code]);
  expect(single.errors).toBeUndefined();
  expect(single.data.subscriptionsImport.addedCount).toBe(1);
  expect(
    (await memberships(db, fixture.users[0].id)).map(
      ({ sectionId }) => sectionId,
    ),
  ).toEqual([fixture.section.id]);
  expect(
    (await gql([code], "REMOVE")).data.subscriptionsImport.removedCount,
  ).toBe(1);
  expect(await memberships(db, fixture.users[0].id)).toEqual([]);
});

test("subscription.duplicate-input-semantics MCP", async ({
  page,
  request,
  calendar: fixture,
  second: _second,
  isolatedWorker,
  oauthOwner,
}) => {
  const db = isolatedWorker.database.owner;
  const scope = "workspace.subscription:write";
  const resource = `${isolatedWorker.origin}/api/mcp`;
  const clientId = await registerPublicClient(request, scope, oauthOwner);
  const client = new Client({ name: "subscription-duplicates", version: "1" });
  try {
    const { response, tokenBody } = await issueAccessTokenForClient(
      page,
      request,
      { clientId, scope, resource, owner: oauthOwner },
    );
    expect(response.status()).toBe(200);
    expect(typeof tokenBody.access_token).toBe("string");
    await client.connect(
      new StreamableHTTPClientTransport(new URL(resource), {
        requestInit: {
          headers: { Authorization: `Bearer ${tokenBody.access_token}` },
        },
      }),
    );
    const code = fixture.section.code;
    const call = () =>
      client.callTool({
        name: "workspace_subscription_import",
        arguments: {
          codes: [code, code.toLowerCase(), ` ${code} `],
          semesterId: fixture.section.semesterId,
        },
      });
    const result = await call();
    expect(result.isError).not.toBe(true);
    expect(parseTextContent(result)).toMatchObject({
      addedCount: 1,
      alreadySubscribedCount: 0,
      matchedCodes: [code],
    });
    const baseline = await memberships(db, fixture.users[0].id);
    expect(baseline.map(({ sectionId }) => sectionId)).toEqual([
      fixture.section.id,
    ]);
    const replay = await call();
    expect(replay.isError).not.toBe(true);
    expect(parseTextContent(replay)).toMatchObject({
      addedCount: 0,
      alreadySubscribedCount: 1,
    });
    expect(await memberships(db, fixture.users[0].id)).toEqual(baseline);
  } finally {
    await client.close();
  }
});

for (const operation of [
  "append",
  "batch add",
  "import-codes",
  "remove",
  "batch remove",
] as const) {
  test(`subscription.membership-atomicity ${operation}`, async ({
    page,
    calendar: fixture,
    second,
    failSecondRow,
    isolatedWorker,
  }) => {
    const db = isolatedWorker.database.owner;
    const ids = [fixture.section.id, second.id];
    const codes = [fixture.section.code, second.code];
    const removing = operation === "remove" || operation === "batch remove";
    if (removing)
      await db.userSectionSubscription.createMany({
        data: ids.map((sectionId) => ({
          userId: fixture.users[0].id,
          sectionId,
        })),
      });
    const before = await memberships(db, fixture.users[0].id);
    await failSecondRow(removing ? "DELETE" : "INSERT");
    const data = {
      sectionIds: ids,
      codes,
      semesterId: fixture.section.semesterId,
    };
    const response =
      operation === "append"
        ? await page.request.patch(base, { data: { sectionIds: ids } })
        : operation === "remove"
          ? await page.request.delete(base, { data: { sectionIds: ids } })
          : await page.request.post(
              `${base}/${operation === "import-codes" ? operation : "batch"}`,
              {
                data: {
                  ...data,
                  ...(operation === "import-codes"
                    ? {}
                    : { action: removing ? "remove" : "add" }),
                },
              },
            );
    expect(response.status()).toBe(500);
    expect(await memberships(db, fixture.users[0].id)).toEqual(before);
  });
}

test("subscription.import-replay-after-lost-response", async ({
  page,
  calendar: fixture,
  second,
  isolatedWorker,
}) => {
  const db = isolatedWorker.database.owner;
  const ids = [fixture.section.id, second.id];
  const codes = [fixture.section.code, second.code];
  await page.goto("/workspace/subscriptions");
  let committedResponse: unknown;
  await page.route(
    `**${base}/import-codes`,
    async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      committedResponse = await response.json();
      await route.abort("failed");
    },
    { times: 1 },
  );
  const lostResponse = await page.evaluate(
    async ({ codes, semesterId }) => {
      try {
        await fetch("/api/workspace/subscriptions/import-codes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ codes, semesterId }),
        });
        return false;
      } catch {
        return true;
      }
    },
    { codes, semesterId: fixture.section.semesterId },
  );
  expect(lostResponse).toBe(true);
  expect(committedResponse).toMatchObject({
    addedCount: 2,
    alreadySubscribedCount: 0,
    subscription: {
      sections: expect.arrayContaining(
        ids.map((id) => expect.objectContaining({ id })),
      ),
    },
  });
  const baseline = await memberships(db, fixture.users[0].id);
  expect(baseline.map(({ sectionId }) => sectionId)).toEqual(
    [...ids].sort((a, b) => a - b),
  );
  const repeated = await page.request.post(`${base}/import-codes`, {
    data: { codes, semesterId: fixture.section.semesterId },
  });
  expect(repeated.status()).toBe(200);
  expect(await repeated.json()).toMatchObject({
    addedCount: 0,
    alreadySubscribedCount: 2,
  });
  expect(await memberships(db, fixture.users[0].id)).toEqual(baseline);
});
