import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { type APIRequestContext, expect, test } from "@playwright/test";
import { createCalendarContractFixture } from "../../../../utils/calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";
import { issueAccessToken, parseTextContent } from "../../api/mcp/helpers";

type Fixture = Awaited<ReturnType<typeof createCalendarContractFixture>>;
const listQuery =
  "{ workspace { subscribedSections { items { kind section { id jwId } } } } }";
async function stored(userId: string) {
  return withE2ePrisma((db) =>
    db.userSectionSubscription.findMany({
      where: { userId },
      orderBy: { sectionId: "asc" },
    }),
  );
}
async function gql(
  request: APIRequestContext,
  query: string,
  variables = {},
  headers: Record<string, string> = {},
) {
  const response = await request.post("/api/graphql", {
    headers: { origin: PLAYWRIGHT_BASE_URL, ...headers },
    data: { query, variables },
  });
  return response.json();
}
async function restContract(
  request: APIRequestContext,
  own: Fixture,
  foreign: Fixture,
  headers: Record<string, string> = {},
) {
  const owner = own.users[0].id;
  const other = foreign.users[0].id;
  const baseline = await stored(other);
  const list = await request.get(
    `/api/workspace/subscriptions/current?userId=${other}`,
    { headers },
  );
  expect(list.status()).toBe(200);
  expect(await list.json()).toMatchObject({
    subscription: { userId: owner, sections: [{ id: own.section.id }] },
  });
  expect(
    (
      await request.patch(
        `/api/workspace/subscriptions/${foreign.section.jwId}`,
        { headers, data: { kind: "auditor", userId: other } },
      )
    ).status(),
  ).toBe(400);
  expect(await stored(other)).toEqual(baseline);
  expect(
    (
      await request.patch(
        `/api/workspace/subscriptions/${foreign.section.jwId}`,
        { headers, data: { kind: "auditor" } },
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.delete("/api/workspace/subscriptions", {
        headers,
        data: { sectionIds: [foreign.section.id], userId: other },
      })
    ).status(),
  ).toBe(200);
  expect(await stored(other)).toEqual(baseline);
  expect(
    (
      await request.patch("/api/workspace/subscriptions", {
        headers,
        data: { sectionIds: [foreign.section.id], userId: other },
      })
    ).status(),
  ).toBe(200);
  expect((await stored(owner)).map((row) => row.sectionId).sort()).toEqual(
    [own.section.id, foreign.section.id].sort(),
  );
  expect(
    (
      await request.patch(
        `/api/workspace/subscriptions/${foreign.section.jwId}`,
        { headers, data: { kind: "auditor" } },
      )
    ).status(),
  ).toBe(200);
  expect(
    (await stored(owner)).find((row) => row.sectionId === foreign.section.id)
      ?.kind,
  ).toBe("auditor");
  expect(
    (
      await request.delete("/api/workspace/subscriptions", {
        headers,
        data: { sectionIds: [foreign.section.id], userId: other },
      })
    ).status(),
  ).toBe(200);
  expect(await stored(other)).toEqual(baseline);
}
async function graphqlContract(
  request: APIRequestContext,
  own: Fixture,
  foreign: Fixture,
  headers: Record<string, string> = {},
) {
  const baseline = await stored(foreign.users[0].id);
  const list = await gql(request, listQuery, {}, headers);
  expect(list.errors).toBeUndefined();
  expect(list.data.workspace.subscribedSections.items).toEqual([
    {
      kind: "regular",
      section: { id: own.section.id, jwId: own.section.jwId },
    },
  ]);
  const kind = await gql(
    request,
    "mutation($jwId: Int!) { subscriptionKindUpdate(jwId: $jwId, kind: auditor) { kind } }",
    { jwId: foreign.section.jwId },
    headers,
  );
  expect(kind.errors[0].extensions.code).toBe("NOT_FOUND");
  for (const action of ["Remove", "Add", "Remove"]) {
    const result = await gql(
      request,
      `mutation($jwId: Int!) { subscription${action}(jwId: $jwId) { subscribed } }`,
      { jwId: foreign.section.jwId },
      headers,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data[`subscription${action}`].subscribed).toBe(
      action === "Add",
    );
    expect(await stored(foreign.users[0].id)).toEqual(baseline);
  }
}
async function academicScope(
  request: APIRequestContext,
  own: Fixture,
  foreign: Fixture,
  subscribed: boolean,
) {
  const params = `userId=${foreign.users[0].id}&dateFrom=2026-04-29&dateTo=2026-04-30`;
  for (const [path, key] of [
    ["schedules", "schedules"],
    ["exams", "data"],
    ["homeworks", "data"],
  ] as const) {
    const response = await request.get(`/api/workspace/${path}?${params}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body[key]).toHaveLength(subscribed ? 1 : 0);
    if (subscribed) expect(body[key][0].section.id).toBe(own.section.id);
    expect(JSON.stringify(body)).not.toContain(foreign.course.code);
  }
  const events = await request.get(`/api/workspace/calendar/events?${params}`);
  expect(events.status()).toBe(200);
  const data = (await events.json()).data;
  expect(data.map((event: { type: string }) => event.type).sort()).toEqual(
    (subscribed
      ? ["schedule", "exam", "homework_due", "todo_due", "young_event"]
      : ["todo_due", "young_event"]
    ).sort(),
  );
  expect(data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: `todo-${own.todo.id}` }),
      expect.objectContaining({ youngId: own.young.youngId }),
    ]),
  );
  expect(JSON.stringify(data)).not.toContain(foreign.todo.id);
  expect(JSON.stringify(data)).not.toContain(foreign.young.youngId);
}

test("subscription.user-scoped", async ({ page, request }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const fixtures = [
    await createCalendarContractFixture(),
    await createCalendarContractFixture(),
  ];
  const clientIds: string[] = [];
  await withE2ePrisma((db) =>
    db.user.update({
      where: { id: fixtures[1].users[0].id },
      data: { isAdmin: true },
    }),
  );
  try {
    await withE2ePrisma((db) =>
      db.userSuspension.create({
        data: {
          userId: fixtures[1].users[0].id,
          reason: "Private subscription authority",
        },
      }),
    );
    const anon = await request.get("/workspace/subscriptions", {
      maxRedirects: 0,
    });
    expect(anon.status()).toBe(303);
    expect(anon.headers().location).toContain("/account/sign-in?");
    for (const path of [
      "subscriptions/current",
      "schedules",
      "exams",
      "homeworks",
      "calendar/events",
    ]) {
      expect((await request.get(`/api/workspace/${path}`)).status()).toBe(401);
    }
    expect(
      (
        await request.patch("/api/workspace/subscriptions", {
          data: { sectionIds: [fixtures[0].section.id] },
        })
      ).status(),
    ).toBe(401);
    expect((await gql(request, listQuery)).data.workspace).toBeNull();
    for (let index = 0; index < fixtures.length; index++) {
      const own = fixtures[index];
      const foreign = fixtures[1 - index];
      const foreignBaseline = await stored(foreign.users[0].id);
      await page.context().clearCookies();
      await page
        .context()
        .addCookies([
          await createSignedSessionCookie(own.users[0].id),
          { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
        ]);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(
          `/workspace/subscriptions?userId=${foreign.users[0].id}`,
        );
        await expect(
          page
            .locator(
              `a[data-testid="subscription-course-link"][href="/catalog/sections/${own.section.jwId}"]`,
            )
            .filter({ visible: true }),
        ).toBeVisible();
        await expect(
          page.locator(
            `a[data-testid="subscription-course-link"][href="/catalog/sections/${foreign.section.jwId}"]`,
          ),
        ).toHaveCount(0);
      }
      await academicScope(page.request, own, foreign, true);
      await restContract(page.request, own, foreign);
      await graphqlContract(page.request, own, foreign);
      const scope = "workspace.subscription:read workspace.subscription:write";
      for (const surface of ["rest", "graphql", "mcp"]) {
        const resource = `${PLAYWRIGHT_BASE_URL}/api/${surface === "rest" ? "auth" : surface}`;
        const token = await issueAccessToken(page, request, {
          scope,
          clientScopes: scope.split(" "),
          resource,
        });
        clientIds.push(token.clientId);
        const headers = { Authorization: `Bearer ${token.accessToken}` };
        if (surface === "rest")
          await restContract(request, own, foreign, headers);
        else if (surface === "graphql")
          await graphqlContract(request, own, foreign, headers);
        else {
          const client = new Client({
            name: "subscription-owner",
            version: "1",
          });
          try {
            await client.connect(
              new StreamableHTTPClientTransport(new URL(resource), {
                requestInit: { headers },
              }),
            );
            const result = await client.callTool({
              name: "workspace_subscription_list",
              arguments: { userId: foreign.users[0].id },
            });
            expect(result.isError).not.toBe(true);
            expect(parseTextContent(result)).toMatchObject({
              sections: [{ id: own.section.id }],
            });
            for (const action of ["remove", "add", "remove"]) {
              const changed = await client.callTool({
                name: `workspace_subscription_${action}`,
                arguments: {
                  jwId: foreign.section.jwId,
                  userId: foreign.users[0].id,
                },
              });
              expect(changed.isError).not.toBe(true);
              expect(
                (await stored(own.users[0].id)).some(
                  (row) => row.sectionId === foreign.section.id,
                ),
              ).toBe(action === "add");
              expect(await stored(foreign.users[0].id)).toEqual(
                foreignBaseline,
              );
            }
          } finally {
            await client.close();
          }
        }
      }
      await page.goto(`/catalog/sections/${own.section.jwId}`);
      await page
        .getByRole("button", { name: "Unsubscribe from section", exact: true })
        .click();
      const confirmation = page.getByRole("alertdialog");
      if (await confirmation.count())
        await confirmation
          .getByRole("button", { name: /Unsubscribe|Confirm/i })
          .click();
      await expect(
        page.getByRole("button", { name: "Subscribe to section", exact: true }),
      ).toBeVisible();
      expect(await stored(own.users[0].id)).toHaveLength(0);
      await academicScope(page.request, own, foreign, false);
      await page
        .getByRole("button", { name: "Subscribe to section", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Subscribe to section" })
        .getByRole("button", { name: "Subscribe to section", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Unsubscribe from section",
          exact: true,
        }),
      ).toBeVisible();
      await academicScope(page.request, own, foreign, true);
      expect(await stored(foreign.users[0].id)).toEqual(foreignBaseline);
    }
  } finally {
    await withE2ePrisma((db) =>
      db.oAuthClient.deleteMany({ where: { clientId: { in: clientIds } } }),
    );
    for (const fixture of fixtures) await fixture.cleanup();
  }
});
