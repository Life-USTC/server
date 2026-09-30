import { expect } from "vitest";
import { startOfShanghaiDay } from "@/lib/time/shanghai-format";
import { isolatedGraphqlTest } from "../shared/isolated-graphql-fixture";
import { type McpHarness, ownMcpHarness } from "./mcp/_harness/client";

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

const it = isolatedGraphqlTest
  .extend("mcpOwners", async ({ graphqlRuntime, onTestFinished }, { onCleanup }) => {
    const userId = "graphql-domain-owner";
    const otherId = "graphql-domain-other";
    const resources: ReturnType<typeof ownMcpHarness>[] = [];
    onCleanup(async () => {
      // Keep the SDK open until every admitted setup/body workflow finishes.
      // The enclosing protocol fixture reports its cached drain failure once.
      await Promise.allSettled([graphqlRuntime.drain()]);
      const results = await Promise.allSettled(
        resources.map((resource) => resource.client.close()),
      );
      const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length) {
        const error = new AggregateError(
          failures,
          "GraphQL MCP fixture cleanup failed",
        );
        onTestFinished(() => {
          throw error;
        });
      }
    });
    const owner = ownMcpHarness(userId, undefined, {
      run: graphqlRuntime.request,
    });
    resources.push(owner);
    const other = ownMcpHarness(otherId, undefined, {
      run: graphqlRuntime.request,
    });
    resources.push(other);
    return { userId, otherId, owner, other };
  })
  .extend(
    "workspace",
    async ({ isolatedDatabase, graphqlRuntime, mcpOwners }) => {
      return graphqlRuntime.run(async () => {
        const db = isolatedDatabase.owner;
        const { userId, otherId } = mcpOwners;
        const marker = crypto.randomUUID();
        const youngId = `graphql-event-${marker}`;
        const organizerId = `graphql-organizer-${marker}`;
        const homeworkIds = Array.from({ length: 4 }, () => crypto.randomUUID());
        const now = new Date(Math.floor(Date.now() / 1000) * 1000);
        const future = new Date(now.getTime() + 30 * 60_000);
        const past = new Date(now.getTime() - 24 * 60 * 60_000);
        const semester = await db.semester.create({
          data: {
            jwId: 1,
            nameCn: "GraphQL workspace semester",
            code: "GRAPHQL-WORKSPACE",
          },
        });
        const course = await db.course.create({
          data: {
            jwId: 1,
            nameCn: "GraphQL workspace course",
            code: "GRAPHQL-WORKSPACE",
          },
        });
        const section = await db.section.create({
          data: {
            jwId: 1,
            code: "GRAPHQL-WORKSPACE.01",
            courseId: course.id,
            semesterId: semester.id,
          },
        });
        await db.user.createMany({
          data: [userId, otherId].map((id) => ({
            id,
            email: `${id}@example.test`,
          })),
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
        await graphqlRuntime.request(() => mcpOwners.owner.initialize());
        await graphqlRuntime.request(() => mcpOwners.other.initialize());
        const owner = mcpOwners.owner.client;
        const other = mcpOwners.other.client;
        const run = (
          client: McpHarness,
          document: string,
          variables: Record<string, unknown> = {},
        ) =>
          graphqlRuntime.request(() =>
            client.call<Result>("graphql_operation_run", {
              document,
              variables,
              confirmed: true,
              locale: "en-us",
            }),
          );
        const registered = (
          client: McpHarness,
          operationId: string,
          variables: Record<string, unknown> = {},
        ) =>
          graphqlRuntime.request(() =>
            client.call<Result>("graphql_operation_run", {
              operationId,
              variables,
              confirmed: true,
              locale: "en-us",
            }),
          );

        return {
          db,
          marker,
          userId,
          otherId,
          youngId,
          organizerId,
          owner,
          other,
          section,
          homeworkIds,
          now,
          future,
          past,
          run,
          registered,
          graphqlRuntime,
        };
      });
    },
  );

it("graphql.subscription-kind", async ({ graphqlRuntime, workspace }) => {
  await graphqlRuntime.run(async () => {
    const { db, userId, owner, other, section, registered, graphqlRuntime } =
      workspace;
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
      const denied = await graphqlRuntime.request(() =>
        other.callToolResult("graphql_operation_run", {
          operationId: "workspace.subscription.kind.update.v1",
          variables: { jwId: section.jwId, kind },
          confirmed: true,
        }),
      );
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
});

it("graphql.homework-completion-requirement", async ({ graphqlRuntime, workspace }) => {
  await graphqlRuntime.run(async () => {
    const {
      db,
      userId,
      otherId,
      owner,
      other,
      section,
      homeworkIds,
      past,
      registered,
    } = workspace;
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
});

it("graphql.young-event-subscriptions", async ({ graphqlRuntime, workspace }) => {
  await graphqlRuntime.run(async () => {
    const { db, userId, youngId, owner, other, run } = workspace;
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
});

it("graphql.young-organizer-subscriptions", async ({ graphqlRuntime, workspace }) => {
  await graphqlRuntime.run(async () => {
    const { db, userId, organizerId, owner, other, run } = workspace;
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
});

it("graphql.young-reminders", async ({ graphqlRuntime, workspace }) => {
  await graphqlRuntime.run(async () => {
    const { db, youngId, owner, other, run } = workspace;
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
});

it("graphql.young-daily-digests", async ({ graphqlRuntime, workspace }) => {
  await graphqlRuntime.run(async () => {
    const { db, userId, youngId, organizerId, owner, other, now, run } =
      workspace;
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
});

it("graphql.young-calendar", async ({ graphqlRuntime, workspace }) => {
  await graphqlRuntime.run(async () => {
    const { db, youngId, owner, other, run } = workspace;
    const eventStart = new Date("2026-09-27T23:30:00+08:00");
    const eventEnd = new Date("2026-09-28T00:30:00+08:00");
    await db.youngEvent.update({
      where: { youngId },
      data: { startAt: eventStart, endAt: eventEnd, applyEndAt: null },
    });
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
    }).format(eventStart);
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
    expect(new Date(events[0].at).getTime()).toBe(eventStart.getTime());
    expect(await run(other, query, { from: date, to: date })).toMatchObject({
      success: true,
      data: {
        workspace: { calendarEvents: { items: [], pageInfo: { total: 0 } } },
      },
    });
    const overlap = await run(owner, query, {
      from: "2026-09-28",
      to: "2026-09-28",
    });
    expect(overlap).toMatchObject({
      success: true,
      data: {
        workspace: {
          calendarEvents: { items: [{ youngId }], pageInfo: { total: 1 } },
        },
      },
    });
    const dayAfterEvent = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(eventEnd.getTime() + 24 * 60 * 60_000));
    expect(
      await run(owner, query, { from: dayAfterEvent, to: dayAfterEvent }),
    ).toMatchObject({
      success: true,
      data: {
        workspace: { calendarEvents: { items: [], pageInfo: { total: 0 } } },
      },
    });
  });
});
