import { createYoga } from "graphql-yoga";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getUserCalendarRecord } from "@/features/calendar/server/calendar-export-data";
import { buildUserCalendarExport } from "@/features/calendar/server/calendar-export-service";
import { listPersonalCalendarPage } from "@/features/calendar/server/personal-calendar-page";
import {
  listYoungNotifications,
  readYoungNotification,
  refreshYoungNotifications,
} from "@/features/young/server/young-notification-service";
import {
  getYoungEventSubscription,
  listYoungEventSubscriptions,
  setYoungEventSubscription,
  setYoungOrganizerSubscription,
} from "@/features/young/server/young-subscription-service";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { createGraphqlContext } from "@/lib/graphql/context";
import { graphqlSchema } from "@/lib/graphql/schema";
import { createFixturePrisma, createTestPrisma } from "../shared/prisma";
import { createMcpHarness } from "./mcp/_harness/client";

const fixture = createFixturePrisma();
const marker = crypto.randomUUID();
const userId = `young-test-${marker}`;
const otherId = `young-other-${marker}`;
const youngId = `young-${marker}`;
const organizerId = `organizer-${marker}`;
const now = new Date("2030-09-15T10:00:00+08:00");

describe("Young workspace owner subscriptions and reminders", () => {
  beforeAll(async () => {
    await fixture.user.createMany({
      data: [
        { id: userId, email: `${userId}@example.invalid` },
        { id: otherId, email: `${otherId}@example.invalid` },
      ],
    });
    await fixture.youngOrganizer.create({
      data: {
        id: organizerId,
        name: "Workshop club",
        normalizedName: organizerId,
      },
    });
    await fixture.youngEvent.create({
      data: {
        youngId,
        name: "[integration-test] Young workshop",
        isActive: true,
        rawJson: {},
        organizerId,
      },
    });
  });
  beforeEach(async () => {
    await fixture.youngNotification.deleteMany({
      where: { userId: { in: [userId, otherId] } },
    });
    await fixture.userYoungEventSubscription.deleteMany({
      where: { userId: { in: [userId, otherId] } },
    });
    await fixture.userYoungOrganizerSubscription.deleteMany({
      where: { userId: { in: [userId, otherId] } },
    });
    await fixture.youngEvent.update({
      where: { youngId },
      data: {
        name: "[integration-test] Young workshop",
        sourceMissing: false,
        location: "East",
        startAt: new Date("2030-09-15T10:30:00+08:00"),
        endAt: new Date("2030-09-15T12:00:00+08:00"),
        applyStartAt: new Date("2030-09-14T08:00:00+08:00"),
        applyEndAt: new Date("2030-09-15T10:15:00+08:00"),
        createdAt: new Date("2030-09-14T09:00:00+08:00"),
      },
    });
  });
  afterAll(async () => {
    await fixture.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
    await fixture.youngEvent.deleteMany({ where: { youngId } });
    await fixture.youngOrganizer.deleteMany({ where: { id: organizerId } });
    await fixture.$disconnect();
  });

  it("serializes repeated subscriptions and keeps owner rows invisible outside their context", async () => {
    await Promise.all([
      setYoungEventSubscription(userId, youngId, true),
      setYoungEventSubscription(userId, youngId, true),
    ]);
    expect((await listYoungEventSubscriptions(userId)).pagination.total).toBe(
      1,
    );
    expect((await listYoungEventSubscriptions(otherId)).pagination.total).toBe(
      0,
    );
    expect(
      await prisma.userYoungEventSubscription.findMany({ where: { userId } }),
    ).toEqual([]);
    expect(
      await withUserDbContext(otherId, (tx) =>
        tx.userYoungEventSubscription.deleteMany({ where: { userId } }),
      ),
    ).toEqual({ count: 0 });
    await expect(
      setYoungEventSubscription(userId, "missing-young-event", true),
    ).rejects.toThrow("Unknown Young event");
  });

  it("generates reminders once even under concurrent refresh and does not leak notification ownership", async () => {
    await setYoungEventSubscription(userId, youngId, true);
    await Promise.all([
      refreshYoungNotifications(userId, now),
      refreshYoungNotifications(userId, now),
    ]);
    const first = await listYoungNotifications(userId, {}, now);
    const second = await listYoungNotifications(userId, {}, now);
    expect(first.data.map((row) => row.id)).toEqual(
      second.data.map((row) => row.id),
    );
    expect(first.data.map((row) => row.kind)).toEqual(
      expect.arrayContaining(["signup_deadline", "event_start"]),
    );
    const id = first.data[0].id;
    expect(await readYoungNotification(otherId, id)).toEqual({
      id,
      success: false,
    });
    expect(await readYoungNotification(userId, id)).toEqual({
      id,
      success: true,
    });
    expect(await readYoungNotification(userId, id)).toEqual({
      id,
      success: true,
    });
    expect(
      (await listYoungNotifications(userId, { unread: true }, now)).data.map(
        (row) => row.id,
      ),
    ).not.toContain(id);
  });

  it("retains existing reminder IDs for a venue change but removes the old start reminder after rescheduling", async () => {
    await setYoungEventSubscription(userId, youngId, true);
    const initial = await listYoungNotifications(userId, {}, now);
    const start = initial.data.find((row) => row.kind === "event_start");
    await fixture.youngEvent.update({
      where: { youngId },
      data: { location: "West" },
    });
    const venue = await listYoungNotifications(userId, {}, now);
    expect(venue.data.find((row) => row.kind === "event_start")?.id).toBe(
      start?.id,
    );
    expect(
      venue.data.filter((row) => row.kind === "event_changed"),
    ).toHaveLength(1);
    await fixture.youngEvent.update({
      where: { youngId },
      data: {
        startAt: new Date("2030-09-16T10:30:00+08:00"),
        endAt: new Date("2030-09-16T12:00:00+08:00"),
      },
    });
    const moved = await listYoungNotifications(userId, {}, now);
    expect(moved.data.some((row) => row.kind === "event_start")).toBe(false);
    const calendar = await listPersonalCalendarPage(userId, {
      dateFrom: "2030-09-16",
      dateTo: "2030-09-16",
    });
    expect(calendar.data.find((row) => row.youngId === youngId)?.at).toBe(
      "2030-09-16T10:30:00+08:00",
    );
  });

  it("withdraws reminders on unsubscribe and supports a new subscription lifecycle", async () => {
    await setYoungEventSubscription(userId, youngId, true);
    await listYoungNotifications(userId, {}, now);
    await setYoungEventSubscription(userId, youngId, false);
    expect(
      (await listYoungNotifications(userId, {}, now)).pagination.total,
    ).toBe(0);
    expect(
      (
        await listPersonalCalendarPage(userId, {
          dateFrom: "2030-09-15",
          dateTo: "2030-09-15",
        })
      ).data,
    ).toEqual([]);
    await setYoungEventSubscription(userId, youngId, true, {
      remindSignup: false,
      remindDeadline: false,
      remindStart: false,
    });
    expect(
      (await listYoungNotifications(userId, {}, now)).pagination.total,
    ).toBe(0);
    await fixture.youngEvent.update({
      where: { youngId },
      data: { location: "Library" },
    });
    expect(
      (await listYoungNotifications(userId, {}, now)).data.map(
        (row) => row.kind,
      ),
    ).toEqual(["event_changed"]);
  });

  it("does not infer cancellation or delete the subscription when the source disappears", async () => {
    await setYoungEventSubscription(userId, youngId, true);
    await fixture.youngEvent.update({
      where: { youngId },
      data: { sourceMissing: true },
    });
    const result = await listYoungNotifications(userId, {}, now);
    expect(result.data.map((row) => row.kind)).toEqual(["event_changed"]);
    expect(result.data[0].body).toContain("来源暂缺");
    expect((await getYoungEventSubscription(userId, youngId)).subscribed).toBe(
      true,
    );
  });

  it("following an organizer produces one digest without automatically subscribing activities", async () => {
    await setYoungOrganizerSubscription(userId, organizerId, true);
    await fixture.userYoungOrganizerSubscription.update({
      where: { userId_organizerId: { userId, organizerId } },
      data: { createdAt: new Date("2030-09-14T08:00:00+08:00") },
    });
    const result = await listYoungNotifications(userId, {}, now);
    expect(result.data.map((row) => row.kind)).toEqual(["organizer_digest"]);
    expect((await listYoungEventSubscriptions(userId)).pagination.total).toBe(
      0,
    );
    expect((await listYoungNotifications(userId, {}, now)).data[0].id).toBe(
      result.data[0].id,
    );
  });

  it("maintenance can only discover recipients through its bounded function", async () => {
    await setYoungEventSubscription(userId, youngId, true);
    const maintenance = createTestPrisma(process.env.MAINTENANCE_DATABASE_URL);
    try {
      const rows = await maintenance.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM public.list_young_notification_recipients(NULL, 100)`;
      expect(rows.map((row) => row.id)).toContain(userId);
      await expect(
        maintenance.userYoungEventSubscription.findMany(),
      ).rejects.toThrow();
      await expect(
        prisma.$queryRaw`SELECT id FROM public.list_young_notification_recipients(NULL, 100)`,
      ).rejects.toThrow();
    } finally {
      await maintenance.$disconnect();
    }
  });

  it("exports only individually subscribed events with stable ICS identity across changes", async () => {
    await setYoungOrganizerSubscription(userId, organizerId, true);
    const exportText = async () => {
      const user = await getUserCalendarRecord(userId);
      if (!user) throw new Error("Expected fixture user");
      return (await buildUserCalendarExport(user, userId)).text.replace(
        /\r?\n[ \t]/g,
        "",
      );
    };
    expect(await exportText()).not.toContain(`young-${youngId}@life-ustc`);
    await setYoungEventSubscription(userId, youngId, true);
    const initial = await exportText();
    expect(initial).toContain(`UID:young-${youngId}@life-ustc`);
    expect(initial).toContain("LOCATION:East");
    await fixture.youngEvent.update({
      where: { youngId },
      data: { location: "West", sourceMissing: true },
    });
    const changed = await exportText();
    expect(changed).toContain(`UID:young-${youngId}@life-ustc`);
    expect(changed).toContain("LOCATION:West");
    await setYoungEventSubscription(userId, youngId, false);
    expect(await exportText()).not.toContain(`UID:young-${youngId}@life-ustc`);
  });

  it("GraphQL shares owner state and rejects missing read/write scopes before mutations", async () => {
    const run = async (source: string, scopes: string[]) => {
      const yoga = createYoga({
        maskedErrors: false,
        schema: graphqlSchema,
        context: await createGraphqlContext({
          locals: { locale: "zh-cn" },
          request: new Request("http://localhost:3000/api/graphql", {
            method: "POST",
          }),
          principal: {
            kind: "oauth",
            userId,
            scopes: new Set(scopes),
            resource: "http://localhost:3000/api/graphql",
            clientId: "integration-test",
          },
        }),
      });
      const response = await yoga.fetch(
        new Request("http://localhost:3000/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: source, variables: { youngId } }),
        }),
      );
      return (await response.json()) as {
        data?: Record<string, unknown>;
        errors?: Array<{ extensions: { code: string } }>;
      };
    };
    const mutation = `mutation($youngId: String!) { youngEventSubscriptionSet(youngId: $youngId, input: {subscribed: true, remindStart: false}) { subscribed remindStart } }`;
    const denied = await run(mutation, ["workspace.young-subscription:read"]);
    expect(denied.errors?.[0]?.extensions.code).toBe("FORBIDDEN");
    expect((await getYoungEventSubscription(userId, youngId)).subscribed).toBe(
      false,
    );
    const written = await run(mutation, ["workspace.young-subscription:write"]);
    expect(written.errors).toBeUndefined();
    expect(written.data?.youngEventSubscriptionSet).toEqual({
      subscribed: true,
      remindStart: false,
    });
    const query = `query($youngId: String!) { workspace { youngEventSubscription(youngId: $youngId) { subscribed } calendarEvents(dateFrom: "2030-09-15", dateTo: "2030-09-15") { items { youngId at } } } }`;
    const read = await run(query, [
      "workspace.young-subscription:read",
      "workspace.calendar:read",
    ]);
    expect(read.errors).toBeUndefined();
    expect(read.data?.workspace).toMatchObject({
      youngEventSubscription: { subscribed: true },
      calendarEvents: { items: [{ youngId, at: "2030-09-15T10:30:00+08:00" }] },
    });
    const hidden = await run(query, ["workspace.young-subscription:read"]);
    expect(hidden.errors?.[0]?.extensions.code).toBe("FORBIDDEN");
  });

  it("MCP exposes the same owner-scoped subscription state and full calendar events", async () => {
    const client = await createMcpHarness(userId);
    try {
      const result = await client.call<{ subscribed: boolean }>(
        "workspace_young_event_subscription_set",
        { youngId, subscribed: true },
      );
      expect(result.subscribed).toBe(true);
      for (const mode of ["default", "full"] as const) {
        const list = await client.call<{
          data: Array<{ youngId: string; remindStart: boolean }>;
        }>("workspace_young_event_subscription_list", { mode });
        expect(list.data.map((row) => row.youngId)).toEqual([youngId]);
        expect(list.data[0].remindStart).toBe(true);
        await refreshYoungNotifications(userId, now);
        const inbox = await client.call<{
          data: Array<{ id: string; kind: string; title: string }>;
        }>("workspace_young_notification_list", { mode });
        expect(inbox.data.length).toBeGreaterThan(0);
        expect(inbox.data[0].id).toBeTruthy();
        expect(inbox.data[0].kind).toBeTruthy();
        expect(inbox.data[0].title).toBeTruthy();
      }
      const events = await client.call<{ events: Array<{ type: string }> }>(
        "workspace_calendar_event_list",
        { dateFrom: "2030-09-15", dateTo: "2030-09-15", mode: "full" },
      );
      expect(events.events.some((row) => row.type === "young_event")).toBe(
        true,
      );
    } finally {
      await client.close();
    }
  });
});
