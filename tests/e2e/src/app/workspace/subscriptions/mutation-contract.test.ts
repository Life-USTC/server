import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, test } from "@playwright/test";
import { createCalendarContractFixture } from "../../../../utils/calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";
import { issueAccessToken, parseTextContent } from "../../api/mcp/helpers";

let fixture: Awaited<ReturnType<typeof createCalendarContractFixture>>;
let second: { id: number; code: string };
let clientId: string | undefined;
let trigger: string | undefined;
async function memberships() {
  return withE2ePrisma((db) =>
    db.userSectionSubscription.findMany({
      where: { userId: fixture.users[0].id },
      orderBy: { sectionId: "asc" },
    }),
  );
}
async function removeFailure() {
  if (!trigger) return;
  await withE2ePrisma(async (db) => {
    await db.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS "${trigger}" ON "UserSectionSubscription"`,
    );
    await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  });
  trigger = undefined;
}
async function failSecondRow(operation: "INSERT" | "DELETE") {
  await removeFailure();
  trigger = `subscription_failure_${crypto.randomUUID().replaceAll("-", "")}`;
  const row = operation === "DELETE" ? "OLD" : "NEW";
  const ownerId = fixture.users[0].id;
  if (!/^[a-zA-Z0-9_-]+$/.test(ownerId))
    throw new Error("Unexpected fixture ID");
  await withE2ePrisma(async (db) => {
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF ${row}."userId" = '${ownerId}' AND ${row}."sectionId" = ${second.id} THEN RAISE EXCEPTION 'isolated subscription failure'; END IF; RETURN ${row}; END; $body$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE ${operation} ON "UserSectionSubscription" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
  });
}
test.beforeEach(async ({ page }) => {
  clientId = undefined;
  trigger = undefined;
  fixture = await createCalendarContractFixture();
  second = await withE2ePrisma(async (db) => {
    await db.userSectionSubscription.deleteMany({
      where: { userId: fixture.users[0].id },
    });
    return db.section.create({
      data: {
        jwId: fixture.section.jwId + 10000,
        code: `${fixture.course.code}.02`,
        courseId: fixture.course.id,
        semesterId: fixture.section.semesterId,
      },
    });
  });
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([await createSignedSessionCookie(fixture.users[0].id)]);
});
test.afterEach(async () => {
  await removeFailure();
  await withE2ePrisma(async (db) => {
    if (clientId) await db.oAuthClient.delete({ where: { clientId } });
    if (second) await db.section.delete({ where: { id: second.id } });
  });
  await fixture?.cleanup();
});

test("subscription.duplicate-input-semantics", async ({ page, request }) => {
  const id = fixture.section.id;
  const code = fixture.section.code;
  const duplicateCodes = [code, code.toLowerCase(), ` ${code} `];
  const append = () =>
    page.request.patch("/api/workspace/subscriptions", {
      data: { sectionIds: [id, id] },
    });
  expect(await (await append()).json()).toMatchObject({
    addedCount: 1,
    alreadySubscribedCount: 0,
  });
  expect(await memberships()).toHaveLength(1);
  const added = await memberships();
  expect(await (await append()).json()).toMatchObject({
    addedCount: 0,
    alreadySubscribedCount: 1,
  });
  expect(await memberships()).toEqual(added);
  const remove = () =>
    page.request.delete("/api/workspace/subscriptions", {
      data: { sectionIds: [id, id] },
    });
  expect((await remove()).status()).toBe(200);
  expect(await memberships()).toHaveLength(0);
  expect((await remove()).status()).toBe(200);
  expect(await memberships()).toHaveLength(0);
  const query = await page.request.post("/api/workspace/subscriptions/query", {
    data: {
      sectionIds: [id, id],
      codes: duplicateCodes,
      semesterId: fixture.section.semesterId,
    },
  });
  expect(query.status()).toBe(200);
  expect(await query.json()).toMatchObject({
    total: 1,
    matchedSectionIds: [id],
    matchedCodes: [code],
  });
  const batch = await page.request.post("/api/workspace/subscriptions/batch", {
    data: {
      action: "add",
      sectionIds: [id, id],
      codes: duplicateCodes,
      semesterId: fixture.section.semesterId,
    },
  });
  expect(batch.status()).toBe(200);
  expect(await batch.json()).toMatchObject({
    addedCount: 1,
    total: 1,
    matchedSectionIds: [id],
    matchedCodes: [code],
  });
  expect((await remove()).status()).toBe(200);
  const imported = await page.request.post(
    "/api/workspace/subscriptions/import-codes",
    { data: { codes: duplicateCodes, semesterId: fixture.section.semesterId } },
  );
  expect(imported.status()).toBe(200);
  expect(await imported.json()).toMatchObject({
    addedCount: 1,
    matchedCodes: [code],
  });
  expect(await memberships()).toHaveLength(1);
  expect((await remove()).status()).toBe(200);
  const queryText =
    "mutation($input: UpdateSectionSubscriptionsInput!) { subscriptionsImport(input: $input) { addedCount removedCount } }";
  const gql = async (codes: string[], action = "ADD") =>
    (
      await page.request.post("/api/graphql", {
        headers: { origin: PLAYWRIGHT_BASE_URL },
        data: {
          query: queryText,
          variables: {
            input: { action, codes, semesterId: fixture.section.semesterId },
          },
        },
      })
    ).json();
  expect((await gql(duplicateCodes)).errors[0].extensions.code).toBe(
    "BAD_USER_INPUT",
  );
  expect(await memberships()).toHaveLength(0);
  const single = await gql([code]);
  expect(single.errors).toBeUndefined();
  expect(single.data.subscriptionsImport.addedCount).toBe(1);
  expect(
    (await gql([code], "REMOVE")).data.subscriptionsImport.removedCount,
  ).toBe(1);
  const scope = "workspace.subscription:write";
  const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
  const token = await issueAccessToken(page, request, {
    scope,
    clientScopes: [scope],
    resource,
  });
  clientId = token.clientId;
  const client = new Client({ name: "subscription-duplicates", version: "1" });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(resource), {
        requestInit: {
          headers: { Authorization: `Bearer ${token.accessToken}` },
        },
      }),
    );
    const call = () =>
      client.callTool({
        name: "workspace_subscription_import",
        arguments: {
          codes: duplicateCodes,
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
    const baseline = await memberships();
    expect(baseline).toHaveLength(1);
    expect(parseTextContent(await call())).toMatchObject({
      addedCount: 0,
      alreadySubscribedCount: 1,
    });
    expect(await memberships()).toEqual(baseline);
  } finally {
    await client.close();
  }
});

test("subscription.membership-atomicity", async ({ page }) => {
  const ids = [fixture.section.id, second.id];
  const codes = [fixture.section.code, second.code];
  await failSecondRow("INSERT");
  const failedAppend = await page.request.patch(
    "/api/workspace/subscriptions",
    { data: { sectionIds: ids } },
  );
  expect(failedAppend.status()).toBe(500);
  expect(await memberships()).toHaveLength(0);
  for (const [path, data] of [
    [
      "/api/workspace/subscriptions/batch",
      {
        action: "add",
        sectionIds: ids,
        semesterId: fixture.section.semesterId,
      },
    ],
    [
      "/api/workspace/subscriptions/import-codes",
      { codes, semesterId: fixture.section.semesterId },
    ],
  ] as const) {
    expect((await page.request.post(path, { data })).status()).toBe(500);
    expect(await memberships()).toHaveLength(0);
  }
  await removeFailure();
  await page.goto("/workspace/subscriptions");
  let committedResponse: unknown;
  await page.route(
    "**/api/workspace/subscriptions/import-codes",
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
      sections: expect.arrayContaining([
        expect.objectContaining({ id: ids[0] }),
        expect.objectContaining({ id: ids[1] }),
      ]),
    },
  });
  const baseline = await memberships();
  expect(baseline).toHaveLength(2);
  const repeated = await page.request.post(
    "/api/workspace/subscriptions/import-codes",
    { data: { codes, semesterId: fixture.section.semesterId } },
  );
  expect(repeated.status()).toBe(200);
  expect(await repeated.json()).toMatchObject({
    addedCount: 0,
    alreadySubscribedCount: 2,
  });
  expect(await memberships()).toEqual(baseline);
  await failSecondRow("DELETE");
  expect(
    (
      await page.request.delete("/api/workspace/subscriptions", {
        data: { sectionIds: ids },
      })
    ).status(),
  ).toBe(500);
  expect(await memberships()).toEqual(baseline);
  expect(
    (
      await page.request.post("/api/workspace/subscriptions/batch", {
        data: {
          action: "remove",
          codes,
          semesterId: fixture.section.semesterId,
        },
      })
    ).status(),
  ).toBe(500);
  expect(await memberships()).toEqual(baseline);
  await removeFailure();
  expect(
    (
      await page.request.delete("/api/workspace/subscriptions", {
        data: { sectionIds: ids },
      })
    ).status(),
  ).toBe(200);
  expect(await memberships()).toHaveLength(0);
});
