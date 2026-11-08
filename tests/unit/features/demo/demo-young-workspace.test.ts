import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_REFERENCE_NOW } from "@/features/demo/lib/demo-types";
import { readDemoCalendarEvents } from "@/features/demo/server/demo-calendar-events";
import { getDemoNavigation } from "@/features/demo/server/demo-workspace";
import {
  getDemoYoungEvent,
  getDemoYoungHomeActivities,
  getDemoYoungSubscriptionFacts,
} from "@/features/demo/server/demo-young";
import {
  getDemoUnreadYoungNotificationsCount,
  getDemoYoungEventSubscriptions,
  getDemoYoungNotifications,
  getDemoYoungOrganizerSubscriptions,
} from "@/features/demo/server/demo-young-workspace";
import { youngReminderCandidates } from "@/features/young/server/young-notification-state";
import {
  personalCalendarPageSchema,
  youngEventSubscriptionListSchema,
  youngNotificationListSchema,
  youngOrganizerSubscriptionListSchema,
} from "@/lib/api/schemas/young-workspace-schemas";

const eventIds = [1, 9, ...Array.from({ length: 19 }, (_, i) => i + 24)].map(
  (number) => `demo-young-${number}`,
);
const organizerIds = Array.from(
  { length: 21 },
  (_, i) => `demo-young-organizer-${i + 1}`,
);
const identity = {
  fixtureVersion: "workspace-v1" as const,
  expiresAt: 1790212500000,
};
const locales = ["en-us", "zh-cn"] as const;
afterEach(() => vi.useRealTimers());

describe("fixed Young workspace graph", () => {
  it("returns actual continuation rows and exact public DTOs in both locales", () => {
    for (const locale of locales) {
      for (const [read, schema, key, expected] of [
        [
          getDemoYoungEventSubscriptions,
          youngEventSubscriptionListSchema,
          "youngId",
          eventIds,
        ],
        [
          getDemoYoungOrganizerSubscriptions,
          youngOrganizerSubscriptionListSchema,
          "organizerId",
          organizerIds,
        ],
      ] as const) {
        const first = read(locale, { page: 1, pageSize: 20 });
        const second = read(locale, { page: 2, pageSize: 20 });
        expect(schema.parse(first)).toEqual(first);
        expect(schema.parse(second)).toEqual(second);
        expect(first.pagination).toMatchObject({
          page: 1,
          pageSize: 20,
          total: 21,
          totalPages: 2,
        });
        expect(second.pagination).toMatchObject({
          page: 2,
          pageSize: 20,
          total: 21,
          totalPages: 2,
        });
        expect(first.data).toHaveLength(20);
        expect(second.data).toHaveLength(1);
        const rows = [...first.data, ...second.data];
        expect(rows.map((row) => Reflect.get(row, key)).sort()).toEqual(
          [...expected].sort(),
        );
        for (let i = 1; i < rows.length; i++) {
          const previous = rows[i - 1];
          const current = rows[i];
          expect(Date.parse(previous.createdAt)).toBeGreaterThanOrEqual(
            Date.parse(current.createdAt),
          );
          if (previous.createdAt === current.createdAt)
            expect(
              String(Reflect.get(previous, key)).localeCompare(
                String(Reflect.get(current, key)),
              ),
            ).toBeLessThanOrEqual(0);
        }
      }
    }
  });

  it("keeps notification pagination, unread filtering and expiration consistent", () => {
    for (const locale of locales) {
      const first = getDemoYoungNotifications(locale, { pageSize: 20 });
      const second = getDemoYoungNotifications(locale, {
        page: 2,
        pageSize: 20,
      });
      const unreadFirst = getDemoYoungNotifications(locale, {
        pageSize: 20,
        unread: true,
      });
      const unreadSecond = getDemoYoungNotifications(locale, {
        page: 2,
        pageSize: 20,
        unread: true,
      });
      for (const page of [first, second, unreadFirst, unreadSecond])
        expect(youngNotificationListSchema.parse(page)).toEqual(page);
      expect(first.data).toHaveLength(20);
      expect(second.data).toHaveLength(3);
      expect(first.pagination).toMatchObject({ total: 23, totalPages: 2 });
      expect(unreadFirst.data).toHaveLength(20);
      expect(unreadSecond.data).toHaveLength(1);
      expect(unreadFirst.pagination).toMatchObject({
        total: 21,
        totalPages: 2,
      });
      const rows = [...first.data, ...second.data];
      expect(new Set(rows.map(({ id }) => id)).size).toBe(23);
      for (let i = 1; i < rows.length; i++) {
        expect(Date.parse(rows[i - 1].createdAt)).toBeGreaterThanOrEqual(
          Date.parse(rows[i].createdAt),
        );
        if (rows[i - 1].createdAt === rows[i].createdAt)
          expect(
            rows[i - 1].id.localeCompare(rows[i].id),
          ).toBeGreaterThanOrEqual(0);
      }
      expect(rows.filter(({ readAt }) => readAt !== null)).toHaveLength(2);
      expect(new Set(rows.map(({ kind }) => kind))).toEqual(
        new Set([
          "event_changed",
          "organizer_digest",
          "signup_open",
          "signup_deadline",
          "event_start",
        ]),
      );
      expect(
        [...unreadFirst.data, ...unreadSecond.data].map(({ id }) => id).sort(),
      ).toEqual(
        rows
          .filter(({ readAt }) => readAt === null)
          .map(({ id }) => id)
          .sort(),
      );
      for (const row of rows) {
        expect(Date.parse(row.createdAt)).toBeLessThanOrEqual(
          Date.parse(DEMO_REFERENCE_NOW),
        );
        if (row.expiresAt)
          expect(Date.parse(row.expiresAt)).toBeGreaterThan(
            Date.parse(DEMO_REFERENCE_NOW),
          );
        if (row.readAt) {
          expect(Date.parse(row.readAt)).toBeGreaterThanOrEqual(
            Date.parse(row.createdAt),
          );
          expect(Date.parse(row.readAt)).toBeLessThanOrEqual(
            Date.parse(DEMO_REFERENCE_NOW),
          );
        }
        if (row.youngId) expect(eventIds).toContain(row.youngId);
        if (row.organizerId) expect(organizerIds).toContain(row.organizerId);
      }
    }
    expect(getDemoUnreadYoungNotificationsCount()).toBe(21);
  });

  it("shares detail membership and preserves the original five Home activities", () => {
    for (let number = 1; number <= 42; number++) {
      const id = `demo-young-${number}`;
      expect(getDemoYoungSubscriptionFacts("events", id)?.subscribed).toBe(
        eventIds.includes(id),
      );
    }
    for (let number = 1; number <= 22; number++) {
      const id = `demo-young-organizer-${number}`;
      expect(getDemoYoungSubscriptionFacts("organizers", id)?.subscribed).toBe(
        organizerIds.includes(id),
      );
    }
    expect(getDemoYoungSubscriptionFacts("events", "private-event")).toBeNull();
    expect(
      getDemoYoungSubscriptionFacts("organizers", "private-organizer"),
    ).toBeNull();
    expect(getDemoYoungSubscriptionFacts("events", "demo-young-1")).toEqual({
      subscribed: true,
      remindSignup: true,
      remindDeadline: false,
      remindStart: true,
    });
    const home = getDemoYoungHomeActivities("en-us");
    expect(home.map(({ title }) => title)).toEqual([
      "Fictional algebra discussion",
      "Fictional physics reading",
      "Fictional programming workshop",
      "Fictional study exchange",
      "Fictional science sketching",
    ]);
    expect(home.map(({ dateLabel }) => dateLabel)).toEqual([
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
    ]);
    expect(home.map(({ href }) => href)).toEqual(
      [1, 2, 3, 4, 5].map((i) => `/catalog/young-events/demo-young-${i}`),
    );
  });

  it("uses honest reminder and digest facts at the fixed reference clock", () => {
    const source = getDemoYoungEvent("en-us", "demo-young-28");
    const subscription = getDemoYoungEventSubscriptions("en-us", {
      pageSize: 100,
    }).data.find(({ youngId }) => youngId === "demo-young-28");
    if (
      !source ||
      !subscription ||
      !source.startAt ||
      !source.endAt ||
      !source.applyStartAt ||
      !source.applyEndAt
    )
      throw new Error("Missing shared reminder fixture");
    expect(source).toMatchObject({
      startAt: "2026-09-24T09:30:00+08:00",
      endAt: "2026-09-24T10:30:00+08:00",
      applyStartAt: "2026-09-24T08:00:00+08:00",
      applyEndAt: "2026-09-24T09:15:00+08:00",
      createdAt: "2026-09-23T14:00:00+08:00",
      organizerId: "demo-young-organizer-7",
    });
    const candidates = youngReminderCandidates(
      {
        ...source,
        startAt: new Date(source.startAt),
        endAt: new Date(source.endAt),
        applyStartAt: new Date(source.applyStartAt),
        applyEndAt: new Date(source.applyEndAt),
      },
      { ...subscription, createdAt: new Date(subscription.createdAt) },
      new Date(DEMO_REFERENCE_NOW),
    );
    expect(candidates.map(({ kind }) => kind).sort()).toEqual([
      "event_start",
      "signup_deadline",
      "signup_open",
    ]);
    const notifications = getDemoYoungNotifications("en-us", {
      pageSize: 100,
    }).data;
    expect(
      notifications
        .filter(
          ({ kind }) =>
            kind === "event_start" ||
            kind === "signup_open" ||
            kind === "signup_deadline",
        )
        .map(({ youngId }) => youngId),
    ).toEqual(["demo-young-28", "demo-young-28", "demo-young-28"]);
    const digests = notifications.filter(
      ({ kind }) => kind === "organizer_digest",
    );
    expect(digests).toHaveLength(1);
    expect(digests[0]).toMatchObject({
      youngId: null,
      organizerId: "demo-young-organizer-7",
      body: "1 个新活动 / new events: Fictional activity 28",
      createdAt: "2026-09-24T00:00:00+08:00",
    });
    const follow = getDemoYoungOrganizerSubscriptions("en-us", {
      pageSize: 100,
    }).data.find(({ organizerId }) => organizerId === "demo-young-organizer-7");
    if (!follow || !source.createdAt)
      throw new Error("Missing fixed digest provenance");
    expect(Date.parse(source.createdAt)).toBeGreaterThan(
      Date.parse(follow.createdAt),
    );
    expect(Date.parse(source.createdAt)).toBeGreaterThanOrEqual(
      Date.parse("2026-09-23T00:00:00+08:00"),
    );
    expect(Date.parse(source.createdAt)).toBeLessThan(
      Date.parse("2026-09-24T00:00:00+08:00"),
    );
    expect(Date.parse(source.startAt)).toBeGreaterThan(
      Date.parse(DEMO_REFERENCE_NOW),
    );
    expect(
      notifications
        .filter(({ kind }) =>
          ["signup_open", "signup_deadline", "event_start"].includes(kind),
        )
        .map(({ kind, expiresAt }) => ({ kind, expiresAt }))
        .sort((a, b) => a.kind.localeCompare(b.kind)),
    ).toEqual([
      { kind: "event_start", expiresAt: "2026-09-24T09:30:00+08:00" },
      { kind: "signup_deadline", expiresAt: "2026-09-24T09:15:00+08:00" },
      { kind: "signup_open", expiresAt: "2026-09-24T09:15:00+08:00" },
    ]);
    const missing = notifications.find(
      ({ youngId, kind }) =>
        youngId === "demo-young-9" && kind === "event_changed",
    );
    expect(missing).toBeDefined();
    expect(getDemoYoungEvent("en-us", "demo-young-9")?.sourceMissing).toBe(
      true,
    );
  });

  it("projects the same subscribed events into the calendar and navigation", () => {
    for (const locale of locales) {
      const calendar = readDemoCalendarEvents(locale, {
        dateFrom: "2026-09-01",
        dateTo: "2027-01-24",
        pageSize: 100,
      });
      expect(personalCalendarPageSchema.parse(calendar)).toEqual(calendar);
      expect(calendar.pagination.total).toBe(30);
      expect(
        calendar.data
          .filter(({ type }) => type === "young_event")
          .map(({ youngId }) => youngId)
          .sort(),
      ).toEqual([...eventIds].sort());
      for (const row of calendar.data.filter(
        ({ type }) => type === "young_event",
      )) {
        if (!row.youngId) throw new Error("Missing subscribed event identity");
        const source = getDemoYoungEvent(locale, row.youngId);
        expect(row).toMatchObject({
          title: source?.name,
          at: source?.startAt,
          endsAt: source?.endAt,
        });
        expect(row.url).toBe(`/catalog/young-events/${row.youngId}`);
      }
    }
    expect(getDemoNavigation(identity)).toMatchObject({
      calendarItemsCount: 30,
      unreadActivityNotificationsCount: 21,
    });
  });

  it("keeps all published timestamps and counts independent of wall time", () => {
    const before = JSON.stringify(
      getDemoYoungNotifications("en-us", { pageSize: 100 }),
    );
    vi.useFakeTimers();
    for (const year of [2000, 2040]) {
      vi.setSystemTime(new Date(`${year}-01-01T00:00:00Z`));
      expect(
        JSON.stringify(getDemoYoungNotifications("en-us", { pageSize: 100 })),
      ).toBe(before);
      expect(getDemoUnreadYoungNotificationsCount()).toBe(21);
    }
  });

  it("isolates returned records across requests and locales", () => {
    const events = getDemoYoungEventSubscriptions("en-us", { pageSize: 100 });
    const notifications = getDemoYoungNotifications("en-us", { pageSize: 100 });
    events.data[0].event.name = "private mutable row";
    notifications.data[0].body = "private mutable message";
    for (const locale of locales) {
      expect(
        JSON.stringify(
          getDemoYoungEventSubscriptions(locale, { pageSize: 100 }),
        ),
      ).not.toContain("private mutable");
      expect(
        JSON.stringify(getDemoYoungNotifications(locale, { pageSize: 100 })),
      ).not.toContain("private mutable");
    }
  });
});
