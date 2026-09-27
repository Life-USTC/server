import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { startOfShanghaiDay } from "@/lib/time/shanghai-format";
import { createFixturePrisma } from "../shared/prisma";
import { createMcpHarness, type McpHarness } from "./mcp/_harness/client";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const userId = `graphql-domain-${marker}`;
const otherId = `graphql-domain-other-${marker}`;
const youngId = `graphql-event-${marker}`;
const organizerId = `graphql-organizer-${marker}`;
let owner: McpHarness;
let other: McpHarness;
let section: { id: number; jwId: number };
const homeworkIds = Array.from({ length: 4 }, () => crypto.randomUUID());
const now = new Date(Math.floor(Date.now() / 1000) * 1000);
const future = new Date(now.getTime() + 30 * 60_000);
const past = new Date(now.getTime() - 24 * 60 * 60_000);
type HomeworkState = {
  id: string;
  completed: boolean;
  completedAt: string | null;
  completionRequired: boolean;
};
type Result = {
  success: boolean;
  data: Record<string, unknown>;
  errors?: Array<{ extensions?: { code?: string } }>;
};
const run = (
  client: McpHarness,
  document: string,
  variables: Record<string, unknown> = {},
) =>
  client.call<Result>("graphql_operation_run", {
    document,
    variables,
    confirmed: true,
    locale: "en-us",
  });
const registered = (
  client: McpHarness,
  operationId: string,
  variables: Record<string, unknown> = {},
) =>
  client.call<Result>("graphql_operation_run", {
    operationId,
    variables,
    confirmed: true,
    locale: "en-us",
  });

beforeAll(async () => {
  const source = await db.section.findFirstOrThrow({
    where: { retiredAt: null },
    select: { courseId: true, semesterId: true },
  });
  section = await db.section.create({
    data: {
      ...source,
      jwId: Math.floor(Math.random() * 1_000_000_000) + 1_000_000_000,
      code: `[integration-test] graphql-${marker}`,
    },
    select: { id: true, jwId: true },
  });
  await db.user.createMany({
    data: [userId, otherId].map((id) => ({ id, email: `${id}@example.test` })),
  });
  await db.youngOrganizer.create({
    data: {
      id: organizerId,
      name: "GraphQL organizer",
      normalizedName: organizerId,
    },
  });
  await db.youngEvent.create({
    data: {
      youngId,
      name: "[integration-test] GraphQL event",
      organizerId,
      rawJson: {},
      isActive: true,
      startAt: future,
      endAt: new Date(future.getTime() + 60 * 60_000),
      applyEndAt: future,
      location: "East",
    },
  });
  await db.homework.createMany({
    data: homeworkIds.map((id, index) => ({
      id,
      sectionId: section.id,
      createdById: userId,
      title: `[integration-test] GraphQL completion ${index}`,
      submissionDueAt: index === 0 ? past : index === 2 ? null : future,
    })),
  });
  owner = await createMcpHarness(userId);
  other = await createMcpHarness(otherId);
});
beforeEach(async () => {
  await db.youngNotification.deleteMany({
    where: { userId: { in: [userId, otherId] } },
  });
  await db.userYoungEventSubscription.deleteMany({
    where: { userId: { in: [userId, otherId] } },
  });
  await db.userYoungOrganizerSubscription.deleteMany({
    where: { userId: { in: [userId, otherId] } },
  });
  await db.userSectionSubscription.deleteMany({
    where: { userId: { in: [userId, otherId] } },
  });
});
afterAll(async () => {
  await owner?.close();
  await other?.close();
  await db.auditLog.deleteMany({
    where: { userId: { in: [userId, otherId] } },
  });
  await db.section.delete({ where: { id: section.id } });
  await db.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
  await db.youngEvent.delete({ where: { youngId } });
  await db.youngOrganizer.delete({ where: { id: organizerId } });
  await db.$disconnect();
});

it("graphql.subscription-kind", async () => {
  await db.userSectionSubscription.create({
    data: { userId, sectionId: section.id, kind: "regular" },
  });
  for (const kind of ["teaching_assistant", "auditor", "regular"]) {
    const changed = await registered(
      owner,
      "workspace.subscription.kind.update.v1",
      { jwId: section.jwId, kind },
    );
    expect(changed).toMatchObject({
      success: true,
      data: { subscriptionKindUpdate: { kind, sectionJwId: section.jwId } },
    });
    const list = await registered(owner, "workspace.subscription.list.v1");
    expect(list).toMatchObject({
      success: true,
      data: {
        workspace: {
          subscribedSections: {
            items: [{ kind, section: { jwId: section.jwId } }],
            pageInfo: { total: 1 },
          },
        },
      },
    });
    const denied = await other.callToolResult("graphql_operation_run", {
      operationId: "workspace.subscription.kind.update.v1",
      variables: { jwId: section.jwId, kind },
      confirmed: true,
    });
    expect(denied.isError).toBe(true);
    expect(denied.structuredContent).toMatchObject({
      errors: [{ extensions: { code: "NOT_FOUND" } }],
    });
    expect(
      await db.userSectionSubscription.findMany({
        where: { sectionId: section.id },
        select: { userId: true, kind: true },
      }),
    ).toEqual([{ userId, kind }]);
  }
});

it("graphql.homework-completion-requirement", async () => {
  await db.userSectionSubscription.createMany({
    data: [
      { userId, sectionId: section.id, kind: "teaching_assistant" },
      { userId: otherId, sectionId: section.id, kind: "regular" },
    ],
  });
  await db.homeworkCompletion.create({
    data: { userId, homeworkId: homeworkIds[3], completedAt: past },
  });
  const read = async (client: McpHarness, completed?: boolean) => {
    const result = await registered(client, "workspace.homework.list.v1", {
      filter: completed === undefined ? {} : { completed },
    });
    expect(result.success).toBe(true);
    return (result.data.workspace as { homeworks: { items: HomeworkState[] } })
      .homeworks.items;
  };
  const all = await read(owner);
  expect(all).toHaveLength(4);
  expect(all.every((item) => item.completionRequired === false)).toBe(true);
  expect(all.find((item) => item.id === homeworkIds[3])).toMatchObject({
    completed: true,
    completedAt: past.toISOString(),
  });
  expect((await read(owner, false)).map((item) => item.id).sort()).toEqual(
    [homeworkIds[1], homeworkIds[2]].sort(),
  );
  expect((await read(other, false)).map((item) => item.id).sort()).toEqual(
    [...homeworkIds].sort(),
  );
  expect((await read(other)).every((item) => item.completionRequired)).toBe(
    true,
  );
  const updated = await registered(
    owner,
    "community.section_homework.update.v1",
    {
      id: homeworkIds[3],
      input: { title: "[integration-test] Updated GraphQL homework" },
    },
  );
  expect(updated).toMatchObject({
    success: true,
    data: {
      homeworkUpdate: {
        homework: {
          completionRequired: false,
          completed: true,
          completedAt: past.toISOString(),
        },
      },
    },
  });
  const created = await registered(
    owner,
    "community.section_homework.create.v1",
    {
      input: {
        sectionJwId: section.jwId,
        title: "[integration-test] New GraphQL homework",
        isMajor: false,
        requiresTeam: false,
      },
    },
  );
  expect(created).toMatchObject({
    success: true,
    data: {
      homeworkCreate: {
        homework: {
          completionRequired: false,
          completed: false,
          completedAt: null,
        },
      },
    },
  });
  await registered(owner, "workspace.subscription.kind.update.v1", {
    jwId: section.jwId,
    kind: "auditor",
  });
  expect((await read(owner)).every((item) => item.completionRequired)).toBe(
    true,
  );
  expect(
    await db.homeworkCompletion.findMany({
      where: { userId },
      select: { homeworkId: true, completedAt: true },
    }),
  ).toEqual([{ homeworkId: homeworkIds[3], completedAt: past }]);
});

it("graphql.young-event-subscriptions", async () => {
  const set = `mutation SetEvent($youngId: String!, $subscribed: Boolean!) { youngEventSubscriptionSet(youngId: $youngId, input: { subscribed: $subscribed, remindStart: false }) { youngId subscribed remindStart } }`;
  expect(await run(owner, set, { youngId, subscribed: true })).toMatchObject({
    success: true,
    data: {
      youngEventSubscriptionSet: {
        youngId,
        subscribed: true,
        remindStart: false,
      },
    },
  });
  const query = `query EventState($youngId: String!) { workspace { youngEventSubscription(youngId: $youngId) { subscribed remindStart } youngEventSubscriptions { items { youngId remindStart } pageInfo { total } } } }`;
  expect(await run(owner, query, { youngId })).toMatchObject({
    success: true,
    data: {
      workspace: {
        youngEventSubscription: { subscribed: true, remindStart: false },
        youngEventSubscriptions: {
          items: [{ youngId, remindStart: false }],
          pageInfo: { total: 1 },
        },
      },
    },
  });
  expect(await run(other, query, { youngId })).toMatchObject({
    success: true,
    data: {
      workspace: {
        youngEventSubscription: { subscribed: false },
        youngEventSubscriptions: { items: [], pageInfo: { total: 0 } },
      },
    },
  });
  await run(other, set, { youngId, subscribed: false });
  expect(
    await db.userYoungEventSubscription.count({ where: { userId, youngId } }),
  ).toBe(1);
  await run(owner, set, { youngId, subscribed: false });
  expect(
    await db.userYoungEventSubscription.count({ where: { userId, youngId } }),
  ).toBe(0);
});

it("graphql.young-organizer-subscriptions", async () => {
  const set = `mutation SetOrganizer($organizerId: ID!, $subscribed: Boolean!) { youngOrganizerSubscriptionSet(organizerId: $organizerId, subscribed: $subscribed) { organizerId subscribed } }`;
  expect(
    await run(owner, set, { organizerId, subscribed: true }),
  ).toMatchObject({
    success: true,
    data: { youngOrganizerSubscriptionSet: { organizerId, subscribed: true } },
  });
  const query = `query OrganizerState($organizerId: ID!) { workspace { youngOrganizerSubscription(organizerId: $organizerId) { subscribed } youngOrganizerSubscriptions { items { organizerId organizer { id } } pageInfo { total } } } }`;
  expect(await run(owner, query, { organizerId })).toMatchObject({
    success: true,
    data: {
      workspace: {
        youngOrganizerSubscription: { subscribed: true },
        youngOrganizerSubscriptions: {
          items: [{ organizerId, organizer: { id: organizerId } }],
          pageInfo: { total: 1 },
        },
      },
    },
  });
  expect(await run(other, query, { organizerId })).toMatchObject({
    success: true,
    data: {
      workspace: {
        youngOrganizerSubscription: { subscribed: false },
        youngOrganizerSubscriptions: { items: [], pageInfo: { total: 0 } },
      },
    },
  });
  await run(other, set, { organizerId, subscribed: false });
  expect(
    await db.userYoungOrganizerSubscription.count({
      where: { userId, organizerId },
    }),
  ).toBe(1);
  expect(await db.userYoungEventSubscription.count({ where: { userId } })).toBe(
    0,
  );
  await run(owner, set, { organizerId, subscribed: false });
  expect(
    await db.userYoungOrganizerSubscription.count({
      where: { userId, organizerId },
    }),
  ).toBe(0);
});

it("graphql.young-reminders", async () => {
  await run(
    owner,
    `mutation Subscribe($youngId: String!) { youngEventSubscriptionSet(youngId: $youngId, input: {subscribed: true}) { subscribed } }`,
    { youngId },
  );
  const query = `query Inbox { workspace { youngNotifications(unread: true) { items { id kind youngId } pageInfo { total } } } }`;
  const result = await run(owner, query);
  expect(result.success).toBe(true);
  const inbox = (
    result.data.workspace as {
      youngNotifications: {
        items: { id: string; kind: string; youngId: string }[];
      };
    }
  ).youngNotifications.items;
  expect(inbox.map((item) => item.kind).sort()).toEqual([
    "event_start",
    "signup_deadline",
  ]);
  expect(inbox.every((item) => item.youngId === youngId)).toBe(true);
  expect(await run(owner, query)).toEqual(result);
  expect(await run(other, query)).toMatchObject({
    success: true,
    data: {
      workspace: { youngNotifications: { items: [], pageInfo: { total: 0 } } },
    },
  });
  const mark = `mutation Read($id: ID!) { youngNotificationRead(id: $id) { id success } }`;
  expect(await run(other, mark, { id: inbox[0].id })).toMatchObject({
    success: true,
    data: { youngNotificationRead: { success: false } },
  });
  expect(
    await db.youngNotification.findUnique({
      where: { id: inbox[0].id },
      select: { readAt: true },
    }),
  ).toEqual({ readAt: null });
  expect(await run(owner, mark, { id: inbox[0].id })).toMatchObject({
    success: true,
    data: { youngNotificationRead: { success: true } },
  });
  expect(await run(owner, query)).toMatchObject({
    success: true,
    data: { workspace: { youngNotifications: { pageInfo: { total: 1 } } } },
  });
});

it("graphql.young-daily-digests", async () => {
  const day = startOfShanghaiDay(now);
  await run(
    owner,
    `mutation Follow($organizerId: ID!) { youngOrganizerSubscriptionSet(organizerId: $organizerId, subscribed: true) { subscribed } }`,
    { organizerId },
  );
  await db.userYoungOrganizerSubscription.update({
    where: { userId_organizerId: { userId, organizerId } },
    data: { createdAt: new Date(day.getTime() - 24 * 60 * 60_000) },
  });
  await db.youngEvent.update({
    where: { youngId },
    data: { createdAt: new Date(day.getTime() - 12 * 60 * 60_000) },
  });
  const query = `query Digests { workspace { youngNotifications { items { id kind organizerId } } } }`;
  const result = await run(owner, query);
  expect(result).toMatchObject({
    success: true,
    data: {
      workspace: {
        youngNotifications: {
          items: [{ kind: "organizer_digest", organizerId }],
        },
      },
    },
  });
  expect(await run(owner, query)).toEqual(result);
  expect(await run(other, query)).toMatchObject({
    success: true,
    data: { workspace: { youngNotifications: { items: [] } } },
  });
  expect(await db.userYoungEventSubscription.count({ where: { userId } })).toBe(
    0,
  );
});

it("graphql.young-calendar", async () => {
  await run(
    owner,
    `mutation Subscribe($youngId: String!) { youngEventSubscriptionSet(youngId: $youngId, input: {subscribed: true}) { subscribed } }`,
    { youngId },
  );
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(future);
  const query = `query Calendar($from: String!, $to: String!) { workspace { calendarEvents(dateFrom: $from, dateTo: $to) { items { type youngId at endsAt location } pageInfo { total } } } }`;
  const result = await run(owner, query, { from: date, to: date });
  expect(result).toMatchObject({
    success: true,
    data: {
      workspace: {
        calendarEvents: {
          items: [
            {
              type: "young_event",
              youngId,
              at: expect.any(String),
              endsAt: expect.any(String),
              location: "East",
            },
          ],
          pageInfo: { total: 1 },
        },
      },
    },
  });
  const events = (
    result.data.workspace as { calendarEvents: { items: { at: string }[] } }
  ).calendarEvents.items;
  expect(new Date(events[0].at).getTime()).toBe(future.getTime());
  expect(await run(other, query, { from: date, to: date })).toMatchObject({
    success: true,
    data: {
      workspace: { calendarEvents: { items: [], pageInfo: { total: 0 } } },
    },
  });
  const tomorrow = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(future.getTime() + 24 * 60 * 60_000));
  expect(
    await run(owner, query, { from: tomorrow, to: tomorrow }),
  ).toMatchObject({
    success: true,
    data: {
      workspace: { calendarEvents: { items: [], pageInfo: { total: 0 } } },
    },
  });
});
