import { describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: async (
    _userId: string,
    callback: (tx: unknown) => unknown,
  ) => callback({ userYoungEventSubscription: { findMany: rows } }),
}));

import { listSubscribedYoungCalendarEvents } from "@/features/young/server/young-calendar-service";

describe("subscribed activity calendar source", () => {
  it("preserves real durations, stable public identifiers, and uncertain source state", async () => {
    const from = new Date("2035-09-15T00:00:00+08:00");
    const to = new Date("2035-09-16T00:00:00+08:00");
    const event = {
      youngId: "42",
      name: "Workshop",
      startAt: from,
      endAt: to,
      imageUrl: null,
      sourceMissing: true,
    };
    rows.mockResolvedValue([{ event }]);
    for (const inclusive of [true, false]) {
      const result = await listSubscribedYoungCalendarEvents(
        "owner",
        from,
        to,
        inclusive,
      );
      expect(result).toMatchObject([
        {
          type: "young_event",
          at: "2035-09-15T00:00:00+08:00",
          filterStart: from,
          filterEnd: to,
          sortKey: from.getTime(),
          payload: { youngId: "42", name: "Workshop", sourceMissing: true },
        },
      ]);
      expect(rows).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "owner",
            event: expect.objectContaining({
              startAt: inclusive ? { lte: to } : { lt: to },
            }),
          }),
        }),
      );
    }
  });
  it("does not invent timestamps for incomplete source records", async () => {
    rows.mockResolvedValue([
      {
        event: {
          youngId: "42",
          name: "Unknown",
          startAt: null,
          endAt: null,
          imageUrl: null,
        },
      },
    ]);
    const result = await listSubscribedYoungCalendarEvents(
      "owner",
      new Date(),
      new Date(),
      false,
    );
    expect(result[0]).toMatchObject({
      at: null,
      filterEnd: null,
      sortKey: Number.MAX_SAFE_INTEGER,
      payload: { startAt: null, endAt: null },
    });
  });
});
