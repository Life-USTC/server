import { expect, type Page, type Route } from "@playwright/test";
import type { CalendarProtocol } from "../../../../utils/calendar-protocol-lifecycle";
import {
  type PrivateCalendar,
  test,
} from "../../../../utils/private-calendar-fixture";
import { type OAuthOwner, parseTextContent } from "../../api/mcp/helpers";
import { memberships, prepareContract } from "./_contract";

const base = "/api/workspace/subscriptions";

async function prepare(
  page: Page,
  owner: OAuthOwner,
  io: CalendarProtocol,
  createCalendar: () => Promise<PrivateCalendar>,
  messages: number,
  feedTokenCreated = false,
) {
  const fixture = await createCalendar();
  const db = owner.worker.database.owner;
  const second = await db.$transaction(async (tx) => {
    await tx.userSectionSubscription.deleteMany({
      where: { userId: fixture.users[0].id },
    });
    return tx.section.create({
      data: {
        jwId: fixture.section.jwId + 10000,
        code: `${fixture.course.code}.02`,
        courseId: fixture.course.id,
        semesterId: fixture.section.semesterId,
      },
    });
  });
  const contract = await prepareContract(
    page,
    owner,
    io,
    fixture.users.map(({ id }) => id),
    messages,
    feedTokenCreated,
  );
  return { fixture, second, db, contract };
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
    oauthOwner,
    createCalendar,
    calendarProtocolRun,
  }) => {
    await calendarProtocolRun(async (io) => {
      const { fixture, db, contract } = await prepare(
        page,
        oauthOwner,
        io,
        createCalendar,
        operation === "query" ? 0 : 2,
      );
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
        expect(body).toMatchObject({
          addedCount: 1,
          alreadySubscribedCount: 0,
        });
      if (operation === "batch") expect(body.addedCount).toBe(1);
      const added = await memberships(db, userId);
      expect(added.map(({ sectionId }) => sectionId)).toEqual(
        operation === "query" || operation === "remove" ? [] : [id],
      );
      const replay = await send();
      await replay.body();
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
      return contract.checks(
        operation === "query" || operation === "remove" ? [] : [id],
        [
          [
            operation === "append"
              ? "PATCH"
              : operation === "remove"
                ? "DELETE"
                : "POST",
            operation === "append" || operation === "remove"
              ? base
              : `${base}/${operation}`,
            [200, 200],
          ],
        ],
      );
    });
  });
}

test("subscription.duplicate-input-semantics GraphQL", async ({
  page,
  oauthOwner,
  createCalendar,
  calendarProtocolRun,
  isolatedWorker,
}) => {
  await calendarProtocolRun(async (io) => {
    const { fixture, db, contract } = await prepare(
      page,
      oauthOwner,
      io,
      createCalendar,
      2,
    );
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
    return contract.checks([], [["POST", "/api/graphql", [400, 200, 200]]]);
  });
});

test("subscription.duplicate-input-semantics MCP", async ({
  page,
  oauthOwner,
  createCalendar,
  calendarProtocolRun,
}) => {
  await calendarProtocolRun(async (io) => {
    const { fixture, db, contract } = await prepare(
      page,
      oauthOwner,
      io,
      createCalendar,
      2,
    );
    const importCodes = await contract.authorizeImports(
      "subscription-duplicates",
    );
    const code = fixture.section.code;
    const semesterId = fixture.section.semesterId;
    if (semesterId === null)
      throw new Error("Expected the prepared calendar semester");
    const call = () =>
      importCodes([code, code.toLowerCase(), ` ${code} `], semesterId);
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
    return contract.checks([fixture.section.id], []);
  });
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
    oauthOwner,
    createCalendar,
    calendarProtocolRun,
    run,
  }) => {
    // The trigger outlives the entire protocol callback and server drain,
    // including interruption; its cleanup is itself an admitted operation.
    await run(async () => {
      let dropTrigger: (() => Promise<void>) | undefined;
      const errors: unknown[] = [];
      try {
        await calendarProtocolRun(async (io) => {
          const { fixture, second, db, contract } = await prepare(
            page,
            oauthOwner,
            io,
            createCalendar,
            0,
          );
          const ids = [fixture.section.id, second.id];
          const codes = [fixture.section.code, second.code];
          const removing =
            operation === "remove" || operation === "batch remove";
          if (removing)
            await db.userSectionSubscription.createMany({
              data: ids.map((sectionId) => ({
                userId: fixture.users[0].id,
                sectionId,
              })),
            });
          const before = await memberships(db, fixture.users[0].id);
          const trigger = `subscription_failure_${crypto.randomUUID().replaceAll("-", "")}`;
          const ownerId = fixture.users[0].id;
          if (!/^[a-zA-Z0-9_-]+$/.test(ownerId))
            throw new Error("Unexpected fixture ID");
          dropTrigger = () =>
            db.$transaction(async (tx) => {
              await tx.$executeRawUnsafe(
                `DROP TRIGGER IF EXISTS "${trigger}" ON "UserSectionSubscription"`,
              );
              await tx.$executeRawUnsafe(
                `DROP FUNCTION IF EXISTS "${trigger}"()`,
              );
            });
          const row = removing ? "OLD" : "NEW";
          await db.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(
              `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF ${row}."userId" = '${ownerId}' AND ${row}."sectionId" = ${second.id} THEN RAISE EXCEPTION 'isolated subscription failure'; END IF; RETURN ${row}; END; $body$`,
            );
            await tx.$executeRawUnsafe(
              `CREATE TRIGGER "${trigger}" BEFORE ${removing ? "DELETE" : "INSERT"} ON "UserSectionSubscription" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
            );
          });
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
          await response.body();
          expect(response.status()).toBe(500);
          expect(await memberships(db, fixture.users[0].id)).toEqual(before);
          return contract.checks(removing ? ids : [], [
            [
              operation === "append"
                ? "PATCH"
                : operation === "remove"
                  ? "DELETE"
                  : "POST",
              operation === "append" || operation === "remove"
                ? base
                : `${base}/${operation === "import-codes" ? operation : "batch"}`,
              [500],
            ],
          ]);
        });
      } catch (error) {
        errors.push(error);
      } finally {
        try {
          await dropTrigger?.();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length)
        throw new AggregateError(
          errors,
          "Subscription rollback and trigger cleanup failed",
        );
    });
  });
}

test("subscription.import-replay-after-lost-response", async ({
  page,
  oauthOwner,
  createCalendar,
  calendarProtocolRun,
}) => {
  await calendarProtocolRun(async (io) => {
    const { fixture, second, db, contract } = await prepare(
      page,
      oauthOwner,
      io,
      createCalendar,
      2,
      true,
    );
    const ids = [fixture.section.id, second.id];
    const codes = [fixture.section.code, second.code];
    await page.goto("/workspace/subscriptions");
    let committedResponse: unknown;
    let accepting = true;
    const pending = new Set<Promise<void>>();
    const errors: unknown[] = [];
    const target = `**${base}/import-codes`;
    const handler = async (route: Route) => {
      const admitted = accepting;
      const operation = Promise.resolve().then(async () => {
        try {
          if (!admitted) throw new Error("Lost-response route is closing");
          const headers = await route.request().allHeaders();
          expect(headers["x-test-community-probe"]).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          );
          const response = await route.fetch({ maxRedirects: 0, headers });
          expect(response.status()).toBe(200);
          committedResponse = await response.json();
          await route.abort("failed");
        } catch (error) {
          errors.push(error);
          if (!page.isClosed()) {
            try {
              await route.abort("failed");
            } catch (abortError) {
              errors.push(abortError);
            }
          }
        }
      });
      pending.add(operation);
      try {
        await operation;
      } finally {
        pending.delete(operation);
      }
    };
    try {
      await page.route(target, handler, { times: 1 });
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
    } catch (error) {
      errors.push(error);
    } finally {
      accepting = false;
      try {
        await page.unroute(target, handler);
      } catch (error) {
        errors.push(error);
      }
      // The actual body owns route work too. On interruption the shared
      // lifecycle closes the page, joins this finally, then observes effects.
      while (pending.size) await Promise.all([...pending]);
    }
    if (errors.length)
      throw new AggregateError(
        errors,
        "Lost subscription response workflow failed",
      );
    return contract.checks(ids, [["POST", `${base}/import-codes`, [200, 200]]]);
  });
});
