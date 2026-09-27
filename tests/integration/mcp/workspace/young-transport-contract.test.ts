import { afterAll, beforeAll, expect, it } from "vitest";
import { setCalendarExportRebuildSenderForTest } from "@/features/calendar/server/calendar-export-queue";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import {
  setYoungEventSubscription,
  setYoungOrganizerSubscription,
} from "@/features/young/server/young-subscription-service";
import {
  getPersonalCalendarRoute,
  getYoungOrganizerStateRoute,
  getYoungSubscriptionStateRoute,
  getYoungWorkspaceRoute,
  postYoungNotificationReadRoute,
  putYoungSubscriptionRoute,
} from "@/lib/api/routes/young-workspace-routes";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma } from "@/lib/db/prisma";
import { createGraphqlYoga } from "@/lib/graphql/server";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthRestAudienceUrls,
} from "@/lib/mcp/urls";
import { assertYoungWriteTransportAuthority } from "../../../shared/personal-state-write-parity";
import { createFixturePrisma } from "../../../shared/prisma";
import {
  createAnonymousMcpHarness,
  createMcpHarness,
  type McpHarness,
} from "../_harness/client";

const db = createFixturePrisma();
const users = [crypto.randomUUID(), crypto.randomUUID()];
const clientId = `young-contract-${crypto.randomUUID()}`;
const scopes = [
  "workspace.young-subscription:read",
  "workspace.young-subscription:write",
  "workspace.young-notification:read",
  "workspace.young-notification:write",
  "workspace.calendar:read",
];
const grants: string[] = [];
const youngIds = Array.from(
  { length: 4 },
  () => `transport-${crypto.randomUUID()}`,
);
const organizers = [crypto.randomUUID(), crypto.randomUUID()];
const notifications = [crypto.randomUUID(), crypto.randomUUID()];
const clients: McpHarness[] = [];
let anonymous: McpHarness;
let sectionId: number;
let groupId: number;
const day = "2027-01-15";
const homeworkId = crypto.randomUUID();
const todoId = crypto.randomUUID();

beforeAll(async () => {
  setCalendarExportRebuildSenderForTest(async () => {});
  await db.user.createMany({
    data: users.map((id) => ({
      id,
      name: "Young transport reader",
      email: `${id}@test.invalid`,
    })),
  });
  await db.oAuthClient.create({
    data: {
      clientId,
      name: "Young transport",
      scopes,
      redirectUris: ["https://client.example/callback"],
    },
  });
  for (const userId of users) {
    grants.push(
      (await db.oAuthConsent.create({ data: { clientId, userId, scopes } }))
        .grantId,
    );
    clients.push(await createMcpHarness(userId));
  }
  anonymous = await createAnonymousMcpHarness();
  await db.youngOrganizer.createMany({
    data: organizers.map((id) => ({ id, name: id, normalizedName: id })),
  });
  for (const [index, youngId] of youngIds.entries()) {
    await db.youngEvent.create({
      data: {
        youngId,
        organizerId: organizers[index === 3 ? 1 : 0],
        name: `Activity ${index}`,
        isActive: true,
        rawJson: {},
        startAt: new Date(`${day}T${15 + index}:00:00+08:00`),
        endAt: new Date(`${day}T${15 + index}:30:00+08:00`),
      },
    });
    await setYoungEventSubscription(users[index === 3 ? 1 : 0], youngId, true, {
      remindSignup: false,
      remindDeadline: false,
      remindStart: false,
    });
  }
  for (let i = 0; i < 2; i++) {
    await setYoungOrganizerSubscription(users[i], organizers[i], true);
    await db.youngNotification.create({
      data: {
        id: notifications[i],
        userId: users[i],
        youngId: youngIds[i === 0 ? 0 : 3],
        kind: "event_changed",
        title: `Private notice ${i}`,
        body: "Owner context",
        dedupeKey: notifications[i],
      },
    });
  }
  const source = await db.course.findFirstOrThrow({ select: { id: true } });
  const marker = 1_800_000_000 + Math.floor(Math.random() * 100_000_000);
  sectionId = (
    await db.section.create({
      data: { courseId: source.id, jwId: marker, code: `TRANSPORT.${marker}` },
    })
  ).id;
  groupId = (
    await db.scheduleGroup.create({
      data: {
        jwId: marker,
        sectionId,
        no: 1,
        isDefault: true,
        stdCount: 0,
        limitCount: 0,
        actualPeriods: 2,
      },
    })
  ).id;
  await db.schedule.create({
    data: {
      sectionId,
      scheduleGroupId: groupId,
      date: new Date(`${day}T00:00:00Z`),
      weekday: 5,
      weekIndex: 1,
      startUnit: 1,
      endUnit: 2,
      startTime: 800,
      endTime: 925,
      periods: 2,
    },
  });
  await db.exam.create({
    data: {
      sectionId,
      jwId: marker,
      examDate: new Date(`${day}T00:00:00Z`),
      startTime: 1000,
      endTime: 1100,
    },
  });
  await db.homework.create({
    data: {
      id: homeworkId,
      sectionId,
      title: "Homework deadline",
      submissionDueAt: new Date(`${day}T12:00:00+08:00`),
    },
  });
  await db.todo.create({
    data: {
      id: todoId,
      userId: users[0],
      title: "Todo deadline",
      dueAt: new Date(`${day}T13:00:00+08:00`),
    },
  });
  await db.userSectionSubscription.create({
    data: { userId: users[0], sectionId },
  });
});
afterAll(async () => {
  setCalendarExportRebuildSenderForTest();
  await Promise.all([
    ...clients.map((client) => client.close()),
    anonymous?.close(),
  ]);
  await db.oAuthConsent.deleteMany({ where: { clientId } });
  await db.oAuthClient.deleteMany({ where: { clientId } });
  if (sectionId) {
    await db.homework.deleteMany({ where: { sectionId } });
    await db.schedule.deleteMany({ where: { sectionId } });
    await db.exam.deleteMany({ where: { sectionId } });
    await db.scheduleGroup.deleteMany({ where: { sectionId } });
    await db.section.delete({ where: { id: sectionId } });
  }
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.youngEvent.deleteMany({ where: { youngId: { in: youngIds } } });
  await db.youngOrganizer.deleteMany({ where: { id: { in: organizers } } });
  await Promise.all([
    db.$disconnect(),
    prisma.$disconnect(),
    authPrisma.$disconnect(),
  ]);
});

async function request(
  index: number,
  path: string,
  method = "GET",
  body?: unknown,
  audience = getOAuthRestAudienceUrls()[0],
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await signResourceBoundOAuthAccessToken({
    clientId,
    userId: users[index],
    grantId: grants[index],
    scopes,
    resources: [audience],
    issuedAt,
    expiresAt: issuedAt + 300,
  });
  if (!token) throw new Error("Expected signed resource token");
  return new Request(`https://example.test${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function graphql(
  index: number,
  query: string,
  variables: Record<string, unknown> = {},
) {
  const response = await createGraphqlYoga(false).fetch(
    await request(
      index,
      "/api/graphql",
      "POST",
      { query, variables },
      getOAuthGraphqlResourceUrl(),
    ),
    { locals: { locale: "zh-cn" } },
  );
  const body = await response.json();
  expect(body.errors).toBeUndefined();
  return body.data;
}
const expectedOwned = (index: number) =>
  index === 0 ? youngIds.slice(0, 3) : youngIds.slice(3);

it("young-workspace.ownership", async () => {
  await assertYoungWriteTransportAuthority();
  for (const index of [0, 1]) {
    const foreign = 1 - index;
    const expected = expectedOwned(index).sort();
    const rest = await getYoungWorkspaceRoute(
      await request(
        index,
        `/api/workspace/young-event-subscriptions?userId=${users[foreign]}`,
      ),
      "events",
    );
    expect(rest.status).toBe(200);
    expect(
      (await rest.json()).data
        .map((row: { youngId: string }) => row.youngId)
        .sort(),
    ).toEqual(expected);
    const gql = await graphql(
      index,
      `{ workspace { youngEventSubscriptions { items { youngId } } youngOrganizerSubscriptions { items { organizerId } } youngNotifications { items { id } } } }`,
    );
    expect(
      gql.workspace.youngEventSubscriptions.items
        .map((row: { youngId: string }) => row.youngId)
        .sort(),
    ).toEqual(expected);
    expect(
      gql.workspace.youngOrganizerSubscriptions.items.map(
        (row: { organizerId: string }) => row.organizerId,
      ),
    ).toEqual([organizers[index]]);
    expect(
      gql.workspace.youngNotifications.items.map(
        (row: { id: string }) => row.id,
      ),
    ).toEqual([notifications[index]]);
    const mcp = await clients[index].call<{ data: { youngId: string }[] }>(
      "workspace_young_event_subscription_list",
      { mode: "full" },
    );
    expect(mcp.data.map((row) => row.youngId).sort()).toEqual(expected);
    for (const [kind, tool, field, ownedId] of [
      [
        "organizers",
        "workspace_young_organizer_subscription_list",
        "organizerId",
        organizers[index],
      ],
      [
        "notifications",
        "workspace_young_notification_list",
        "id",
        notifications[index],
      ],
    ] as const) {
      const response = await getYoungWorkspaceRoute(
        await request(
          index,
          `/api/workspace/young-${kind}?userId=${users[foreign]}`,
        ),
        kind,
      );
      expect(response.status).toBe(200);
      expect(
        (await response.json()).data.map(
          (row: Record<string, string>) => row[field],
        ),
      ).toEqual([ownedId]);
      const result = await clients[index].call<{
        data: Record<string, string>[];
      }>(tool, { mode: "full" });
      expect(result.data.map((row) => row[field])).toEqual([ownedId]);
    }
    const organizerTarget = organizers[foreign];
    const organizerMutation = await putYoungSubscriptionRoute(
      await request(
        index,
        "/api/workspace/young-organizer-subscriptions/target",
        "PUT",
        { subscribed: false },
      ),
      organizerTarget,
      "organizers",
    );
    expect(organizerMutation.status).toBe(200);
    expect((await organizerMutation.json()).subscribed).toBe(false);
    expect(
      (
        await graphql(
          index,
          `mutation($id: ID!) { youngOrganizerSubscriptionSet(organizerId: $id, subscribed: false) { subscribed } }`,
          { id: organizerTarget },
        )
      ).youngOrganizerSubscriptionSet.subscribed,
    ).toBe(false);
    expect(
      await clients[index].call("workspace_young_organizer_subscription_set", {
        organizerId: organizerTarget,
        subscribed: false,
      }),
    ).toMatchObject({ subscribed: false });
    expect(
      await db.userYoungOrganizerSubscription.findUnique({
        where: {
          userId_organizerId: {
            userId: users[foreign],
            organizerId: organizerTarget,
          },
        },
      }),
    ).not.toBeNull();
    const target = youngIds[index === 0 ? 3 : 0];
    const injected = await putYoungSubscriptionRoute(
      await request(
        index,
        "/api/workspace/young-event-subscriptions/target",
        "PUT",
        { subscribed: false, userId: users[foreign] },
      ),
      target,
      "events",
    );
    expect(injected.status).toBe(400);
    const normal = await putYoungSubscriptionRoute(
      await request(
        index,
        "/api/workspace/young-event-subscriptions/target",
        "PUT",
        { subscribed: false },
      ),
      target,
      "events",
    );
    expect(normal.status).toBe(200);
    expect((await normal.json()).subscribed).toBe(false);
    expect(
      (
        await graphql(
          index,
          `mutation($id: String!) { youngEventSubscriptionSet(youngId: $id, input: {subscribed: false}) { subscribed } }`,
          { id: target },
        )
      ).youngEventSubscriptionSet.subscribed,
    ).toBe(false);
    expect(
      await clients[index].call("workspace_young_event_subscription_set", {
        youngId: target,
        subscribed: false,
      }),
    ).toMatchObject({ subscribed: false });
    expect(
      await db.userYoungEventSubscription.findUnique({
        where: { userId_youngId: { userId: users[foreign], youngId: target } },
      }),
    ).not.toBeNull();
    const read = await postYoungNotificationReadRoute(
      await request(index, "/api/workspace/young-notifications/read", "POST"),
      notifications[foreign],
    );
    expect(read.status).toBe(404);
    expect(
      (
        await graphql(
          index,
          `mutation($id: ID!) { youngNotificationRead(id: $id) { success } }`,
          { id: notifications[foreign] },
        )
      ).youngNotificationRead.success,
    ).toBe(false);
    expect(
      await clients[index].call("workspace_young_notification_read", {
        id: notifications[foreign],
      }),
    ).toMatchObject({ success: false });
    expect(
      (
        await db.youngNotification.findUniqueOrThrow({
          where: { id: notifications[foreign] },
        })
      ).readAt,
    ).toBeNull();
  }
  expect(
    (
      await getYoungWorkspaceRoute(
        new Request(
          "https://example.test/api/workspace/young-event-subscriptions",
        ),
        "events",
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await putYoungSubscriptionRoute(
        new Request(
          "https://example.test/api/workspace/young-event-subscriptions/target",
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ subscribed: false }),
          },
        ),
        youngIds[0],
        "events",
      )
    ).status,
  ).toBe(401);
  const anonymousGraphql = await createGraphqlYoga(false).fetch(
    new Request("https://example.test/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query:
          "{ workspace { youngEventSubscriptions { items { youngId } } } }",
      }),
    }),
    { locals: { locale: "zh-cn" } },
  );
  const rejected = await anonymousGraphql.json();
  expect(rejected.data).toEqual({ workspace: null });
  await expect(
    anonymous.call("workspace_young_event_subscription_list", {}),
  ).rejects.toThrow();
});

it("young-workspace.private-response-cache", async () => {
  for (const index of [0, 1]) {
    for (const kind of ["events", "organizers", "notifications"] as const) {
      const response = await getYoungWorkspaceRoute(
        await request(index, "/api/workspace/young-event-subscriptions"),
        kind,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect((await response.json()).data.length).toBeGreaterThan(0);
    }
    for (const response of [
      await getYoungSubscriptionStateRoute(
        await request(index, "/api/workspace/young-event-subscriptions/state"),
        youngIds[index === 0 ? 0 : 3],
      ),
      await getYoungOrganizerStateRoute(
        await request(
          index,
          "/api/workspace/young-organizer-subscriptions/state",
        ),
        organizers[index],
      ),
    ]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect((await response.json()).subscribed).toBe(true);
    }
  }
});

type CalendarRow = {
  id: string;
  type: string;
  at: string | null;
  youngId: string | null;
};
it("young-workspace.calendar-transport-pagination", async () => {
  const rest: CalendarRow[] = [];
  const gql: CalendarRow[] = [];
  for (const page of [1, 2, 3, 4]) {
    const response = await getPersonalCalendarRoute(
      await request(
        0,
        `/api/workspace/calendar?dateFrom=${day}&dateTo=${day}&page=${page}&pageSize=2`,
      ),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pagination).toMatchObject({
      page,
      pageSize: 2,
      total: 7,
      totalPages: 4,
    });
    expect(body.data).toHaveLength(page === 4 ? 1 : 2);
    rest.push(...body.data);
    const data = await graphql(
      0,
      `query($page: Int!) { workspace { calendarEvents(dateFrom: "${day}", dateTo: "${day}", page: {page: $page, pageSize: 2}) { items { id type at youngId } pageInfo { page pageSize total totalPages } } } }`,
      { page },
    );
    expect(data.workspace.calendarEvents.pageInfo).toMatchObject({
      page,
      pageSize: 2,
      total: 7,
      totalPages: 4,
    });
    gql.push(...data.workspace.calendarEvents.items);
  }
  const compact = (rows: CalendarRow[]) =>
    rows.map(({ id, type, at, youngId }) => ({ id, type, at, youngId }));
  expect(compact(rest)).toEqual(gql);
  expect(new Set(rest.map((row) => row.id)).size).toBe(7);
  expect(rest.map((row) => row.type)).toEqual([
    "schedule",
    "exam",
    "homework_due",
    "todo_due",
    "young_event",
    "young_event",
    "young_event",
  ]);
  expect(rest.flatMap((row) => (row.youngId ? [row.youngId] : []))).toEqual(
    youngIds.slice(0, 3),
  );
  const mcp = await clients[0].call<{
    events: {
      type: string;
      at: string;
      payload: { id?: string | number; youngId?: string };
    }[];
  }>("workspace_calendar_event_list", {
    dateFrom: day,
    dateTo: day,
    mode: "full",
  });
  expect(mcp.events).toHaveLength(7);
  expect(mcp.events.map((row) => ({ type: row.type, at: row.at }))).toEqual(
    rest.map((row) => ({ type: row.type, at: row.at })),
  );
  expect(
    mcp.events
      .filter((row) => row.type === "young_event")
      .map((row) => row.payload.youngId),
  ).toEqual(youngIds.slice(0, 3));
  expect(
    mcp.events.find((row) => row.type === "homework_due")?.payload.id,
  ).toBe(homeworkId);
  expect(mcp.events.find((row) => row.type === "todo_due")?.payload.id).toBe(
    todoId,
  );
  const other = await getPersonalCalendarRoute(
    await request(1, `/api/workspace/calendar?dateFrom=${day}&dateTo=${day}`),
  );
  expect(
    (await other.json()).data.map((row: CalendarRow) => row.youngId),
  ).toEqual([youngIds[3]]);
});
