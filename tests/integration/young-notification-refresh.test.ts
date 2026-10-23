import pg from "pg";
import { assert, vi } from "vitest";
import {
  listYoungNotifications,
  readYoungNotification,
} from "@/features/young/server/young-notification-service";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

it("bounds reminder refresh queries while preserving existing notices", {
  tags: ["@Young/Service"],
}, async ({ isolatedDatabase: { owner }, protocolRuntime, expect }) => {
  const now = new Date("2030-09-15T10:00:00+08:00");
  const startAt = new Date("2030-09-15T10:30:00+08:00");
  const endAt = new Date("2030-09-15T12:00:00+08:00");
  const applyStartAt = new Date("2030-09-15T09:30:00+08:00");
  const applyEndAt = new Date("2030-09-15T10:15:00+08:00");
  const followedAt = new Date("2030-09-13T08:00:00+08:00");
  await protocolRuntime.run(async () => {
    const user = await owner.user.create({
      data: { email: "notification-refresh@test.invalid" },
    });
    const organizer = await owner.youngOrganizer.create({
      data: { name: "Workshop club", normalizedName: "workshop-club" },
    });
    const events = Array.from({ length: 8 }, (_, index) => ({
      youngId: `refresh-event-${index}`,
      name: `Workshop ${index}`,
      organizerId: organizer.id,
      isActive: true,
      rawJson: {},
      startAt,
      endAt,
      applyStartAt,
      applyEndAt,
      createdAt: new Date("2030-09-14T13:00:00+08:00"),
    }));
    await owner.youngEvent.createMany({ data: events });
    await owner.userYoungEventSubscription.createMany({
      data: events.map((event) => ({
        userId: user.id,
        youngId: event.youngId,
        createdAt: followedAt,
        observedState: JSON.stringify([
          event.name,
          null,
          null,
          null,
          false,
          startAt,
          endAt,
          applyStartAt,
          applyEndAt,
        ]),
      })),
    });
    await owner.userYoungOrganizerSubscription.create({
      data: {
        userId: user.id,
        organizerId: organizer.id,
        createdAt: followedAt,
      },
    });

    const list = (at: Date) =>
      protocolRuntime.request(() =>
        listYoungNotifications(user.id, { pageSize: 100 }, at),
      );
    async function observedList(at: Date) {
      // Count real notification SQL, retaining native database/RLS behavior.
      const queries = vi.spyOn(pg.Client.prototype, "query");
      try {
        const result = await list(at);
        const statements = queries.mock.calls.map(([query]) =>
          typeof query === "string" ? query : (query as pg.QueryConfig).text,
        );
        return {
          result,
          queries: statements.filter((sql) =>
            sql.includes('"YoungNotification"'),
          ).length,
        };
      } finally {
        queries.mockRestore();
      }
    }

    const first = await observedList(now);
    expect(first.result.pagination.total).toBe(25);
    for (const kind of ["signup_open", "signup_deadline", "event_start"])
      expect(first.result.data.filter((row) => row.kind === kind)).toHaveLength(
        8,
      );
    expect(
      first.result.data.filter((row) => row.kind === "organizer_digest"),
    ).toHaveLength(1);
    for (const kind of ["signup_open", "organizer_digest"]) {
      const notification = first.result.data.find((row) => row.kind === kind);
      assert(notification, `Missing ${kind} notification`);
      expect(
        await protocolRuntime.request(() =>
          readYoungNotification(user.id, notification.id),
        ),
      ).toEqual({ id: notification.id, success: true });
    }
    const stored = await owner.youngNotification.findMany({
      where: { userId: user.id },
      orderBy: { id: "asc" },
    });
    const later = new Date(now.getTime() + 60_000);
    const replay = await observedList(later);
    const repeated = await Promise.all([list(later), list(later)]);
    for (const result of [replay.result, ...repeated]) {
      expect(result.pagination.total).toBe(25);
      expect(result.data.map((row) => row.id)).toEqual(
        first.result.data.map((row) => row.id),
      );
    }
    expect(
      await owner.youngNotification.findMany({
        where: { userId: user.id },
        orderBy: { id: "asc" },
      }),
    ).toEqual(stored);
    // Listing still counts and reads notices; candidate count must not add
    // per-reminder existence checks or return unused notification rows.
    expect(first.queries).toBeGreaterThanOrEqual(2);
    expect(first.queries).toBeLessThanOrEqual(4);
    expect(replay.queries).toBeLessThanOrEqual(4);
  });
});
