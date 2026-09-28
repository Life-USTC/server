import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { type APIRequestContext, expect, test } from "@playwright/test";
import { createCalendarContractFixture } from "../../../../utils/calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import {
  expectSubscribedWebProjections,
  observeSubscriptionState,
  type SubscriptionFixture,
  signInSubscriptionOwner,
} from "../../../../utils/subscription-consumption";
import { issueAccessToken, parseTextContent } from "../../api/mcp/helpers";

async function createOwners() {
  const alice = await createCalendarContractFixture();
  try {
    const bob = await createCalendarContractFixture();
    try {
      await withE2ePrisma(async (db) => {
        await db.user.update({
          where: { id: bob.users[0].id },
          data: { isAdmin: true },
        });
        await db.userSuspension.create({
          data: {
            userId: bob.users[0].id,
            reason: "Personal reads remain available during suspension",
          },
        });
      });
      await withE2ePrisma((db) =>
        db.userSectionSubscription.update({
          where: {
            userId_sectionId: {
              userId: bob.users[0].id,
              sectionId: bob.section.id,
            },
          },
          data: { kind: "auditor" },
        }),
      );
      return [alice, bob] as const;
    } catch (error) {
      await bob.cleanup();
      throw error;
    }
  } catch (error) {
    await alice.cleanup();
    throw error;
  }
}

async function expectRestSubscription(
  request: APIRequestContext,
  own: SubscriptionFixture,
  foreign: SubscriptionFixture,
  kind: string,
  headers: Record<string, string> = {},
) {
  const response = await request.get(
    `/api/workspace/subscriptions/current?userId=${foreign.users[0].id}`,
    { headers },
  );
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.subscription.userId).toBe(own.users[0].id);
  expect(body.subscription.sections).toHaveLength(1);
  expect(body.subscription.sections[0]).toMatchObject({
    id: own.section.id,
    jwId: own.section.jwId,
    kind,
    course: { code: own.course.code },
    semester: { id: own.section.semesterId },
  });
  expect(JSON.stringify(body)).not.toContain(foreign.course.code);
}

async function expectGraphqlSubscription(
  request: APIRequestContext,
  own: SubscriptionFixture,
  kind: string,
  headers: Record<string, string> = {},
) {
  const response = await request.post("/api/graphql", {
    headers: { origin: PLAYWRIGHT_BASE_URL, ...headers },
    data: {
      query:
        "{ workspace { subscribedSections { items { kind section { id jwId } } } } }",
    },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.errors).toBeUndefined();
  expect(body.data.workspace.subscribedSections.items).toEqual([
    { kind, section: { id: own.section.id, jwId: own.section.jwId } },
  ]);
}

test("subscription.consume-web-known-state", async ({ page }) => {
  test.setTimeout(120_000);
  const owners = await createOwners();
  try {
    for (const [index, own] of owners.entries()) {
      const foreign = owners[1 - index];
      const baseline = await observeSubscriptionState(own);
      await test.step(`Owner ${index + 1}: subscriptions, calendar and overview consume the same seeded state`, async () => {
        await signInSubscriptionOwner(page, own);
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 1000 });
          await expectSubscribedWebProjections(page, own, foreign);
        }
      });
      expect(await observeSubscriptionState(own)).toEqual(baseline);
    }
  } finally {
    for (const owner of owners) await owner.cleanup();
  }
});

test("subscription.consume-protocols-known-state", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const owners = await createOwners();
  const clientIds: string[] = [];
  try {
    for (const [index, own] of owners.entries()) {
      const foreign = owners[1 - index];
      const kind = index === 0 ? "regular" : "auditor";
      const baseline = await observeSubscriptionState(own);
      await signInSubscriptionOwner(page, own);
      await test.step(`Owner ${index + 1}: session reads expose only their subscribed academic records`, async () => {
        await expectRestSubscription(page.request, own, foreign, kind);
        await expectGraphqlSubscription(page.request, own, kind);
        const params = `userId=${foreign.users[0].id}&dateFrom=${own.date}&dateTo=${own.activityDate}`;
        for (const [path, key] of [
          ["schedules", "schedules"],
          ["exams", "data"],
          ["homeworks", "data"],
        ] as const) {
          const response = await page.request.get(
            `/api/workspace/${path}?${params}`,
          );
          expect(response.status()).toBe(200);
          const body = await response.json();
          expect(body[key]).toHaveLength(1);
          expect(body[key][0].section.id).toBe(own.section.id);
          expect(JSON.stringify(body)).not.toContain(foreign.course.code);
        }
        const academic = await withE2ePrisma(async (db) => ({
          schedule: await db.schedule.findFirstOrThrow({
            where: { sectionId: own.section.id },
            select: { id: true },
          }),
          exam: await db.exam.findFirstOrThrow({
            where: { sectionId: own.section.id },
            select: { id: true },
          }),
        }));
        const response = await page.request.get(
          `/api/workspace/calendar/events?${params}`,
        );
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(
          body.data.map((event: { type: string }) => event.type).sort(),
        ).toEqual([
          "exam",
          "homework_due",
          "schedule",
          "todo_due",
          "young_event",
        ]);
        expect(
          body.data.map((event: { id: string }) => event.id).sort(),
        ).toEqual(
          [
            `schedule-${academic.schedule.id}-${own.date}T09:00:00+08:00`,
            `exam-${academic.exam.id}`,
            `homework-${own.homework.id}`,
            `todo-${own.todo.id}`,
            `young-${own.young.youngId}`,
          ].sort(),
        );
        expect(body.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: "schedule",
              title: own.course.nameCn,
              url: `/catalog/sections/${own.section.jwId}`,
            }),
            expect.objectContaining({
              type: "exam",
              title: own.course.nameCn,
              url: "/workspace/exams",
            }),
            expect.objectContaining({
              type: "homework_due",
              id: `homework-${own.homework.id}`,
              title: own.homework.title,
              url: "/workspace/homeworks",
            }),
            expect.objectContaining({ id: `todo-${own.todo.id}` }),
            expect.objectContaining({ youngId: own.young.youngId }),
          ]),
        );
        expect(JSON.stringify(body)).not.toContain(foreign.course.nameCn);
        expect(JSON.stringify(body)).not.toContain(
          `/catalog/sections/${foreign.section.jwId}`,
        );
        expect(JSON.stringify(body)).not.toContain(foreign.homework.id);
        expect(JSON.stringify(body)).not.toContain(foreign.todo.id);
        expect(JSON.stringify(body)).not.toContain(foreign.young.youngId);
      });
      for (const surface of ["rest", "graphql", "mcp"] as const) {
        await test.step(`Owner ${index + 1}: ${surface} bearer reads preserve identity and subscription kind`, async () => {
          const scope = "workspace.subscription:read";
          const resource = `${PLAYWRIGHT_BASE_URL}/api/${surface === "rest" ? "auth" : surface}`;
          const token = await issueAccessToken(page, request, {
            scope,
            clientScopes: [scope],
            resource,
          });
          clientIds.push(token.clientId);
          const headers = { Authorization: `Bearer ${token.accessToken}` };
          // The bearer owner is deliberately different from the ambient browser session.
          await signInSubscriptionOwner(page, foreign);
          if (surface === "rest")
            await expectRestSubscription(
              page.request,
              own,
              foreign,
              kind,
              headers,
            );
          else if (surface === "graphql")
            await expectGraphqlSubscription(page.request, own, kind, headers);
          else {
            const client = new Client({
              name: "subscription-consumer",
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
                arguments: { userId: foreign.users[0].id, mode: "full" },
              });
              expect(result.isError).not.toBe(true);
              const body = parseTextContent(result);
              expect(body.success).toBe(true);
              expect(body.sections).toEqual([
                expect.objectContaining({
                  id: own.section.id,
                  jwId: own.section.jwId,
                  kind,
                  course: expect.objectContaining({ code: own.course.code }),
                }),
              ]);
              expect(JSON.stringify(body)).not.toContain(foreign.course.code);
            } finally {
              await client.close();
            }
          }
          await signInSubscriptionOwner(page, own);
        });
      }
      expect(await observeSubscriptionState(own)).toEqual(baseline);
    }
  } finally {
    await withE2ePrisma((db) =>
      db.oAuthClient.deleteMany({ where: { clientId: { in: clientIds } } }),
    );
    for (const owner of owners) await owner.cleanup();
  }
});

// Authentication is independent of the state projection cases above.
test("subscription.consume-anonymous-denied", async ({ request }) => {
  const page = await request.get("/workspace/subscriptions", {
    maxRedirects: 0,
  });
  expect(page.status()).toBe(303);
  expect(page.headers().location).toContain("/account/sign-in?");
  for (const path of [
    "subscriptions/current",
    "schedules",
    "exams",
    "homeworks",
    "calendar/events",
  ]) {
    expect((await request.get(`/api/workspace/${path}`)).status()).toBe(401);
  }
  const graph = await request.post("/api/graphql", {
    headers: { origin: PLAYWRIGHT_BASE_URL },
    data: {
      query:
        "{ workspace { subscribedSections { items { kind section { id } } } } }",
    },
  });
  expect(graph.status()).toBe(200);
  expect((await graph.json()).data.workspace).toBeNull();
});

test("subscription.consume-unsubscribed-known-state", async ({ page }) => {
  const owners = await createOwners();
  try {
    // Arrange the absence directly; this consumer test does not depend on a
    // successful unsubscribe operation through any product entry point.
    await withE2ePrisma((db) =>
      db.userSectionSubscription.deleteMany({
        where: { userId: { in: owners.map((owner) => owner.users[0].id) } },
      }),
    );
    for (const [index, own] of owners.entries()) {
      const foreign = owners[1 - index];
      const baseline = await observeSubscriptionState(own);
      expect(baseline.sections).toEqual([]);
      await signInSubscriptionOwner(page, own);
      await test.step(`${index === 0 ? "Regular user" : "Suspended administrator"}: no academic records; independent personal items remain private`, async () => {
        const params = `userId=${foreign.users[0].id}&dateFrom=${own.date}&dateTo=${own.activityDate}`;
        const current = await page.request.get(
          `/api/workspace/subscriptions/current?${params}`,
        );
        expect(current.status()).toBe(200);
        expect((await current.json()).subscription).toMatchObject({
          userId: own.users[0].id,
          sections: [],
        });
        for (const [path, key] of [
          ["schedules", "schedules"],
          ["exams", "data"],
          ["homeworks", "data"],
        ] as const) {
          const response = await page.request.get(
            `/api/workspace/${path}?${params}`,
          );
          expect(response.status()).toBe(200);
          const body = await response.json();
          expect(body[key]).toEqual([]);
          expect(JSON.stringify(body)).not.toContain(foreign.course.code);
        }
        const calendar = await page.request.get(
          `/api/workspace/calendar/events?${params}`,
        );
        expect(calendar.status()).toBe(200);
        const body = await calendar.json();
        expect(
          body.data.map((event: { type: string }) => event.type).sort(),
        ).toEqual(["todo_due", "young_event"]);
        expect(body.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: `todo-${own.todo.id}`,
              title: own.todo.title,
            }),
            expect.objectContaining({
              youngId: own.young.youngId,
              title: own.young.name,
            }),
          ]),
        );
        expect(JSON.stringify(body)).not.toContain(foreign.todo.id);
        expect(JSON.stringify(body)).not.toContain(foreign.young.youngId);
        expect(JSON.stringify(body)).not.toContain(foreign.course.code);
      });
      expect(await observeSubscriptionState(own)).toEqual(baseline);
    }
  } finally {
    for (const owner of owners) await owner.cleanup();
  }
});
