import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw, withAdapter } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  withAdapter: vi.fn(),
}));
vi.mock("@/lib/db/prisma-adapter", () => ({
  withRuntimeDatabaseAdapter: withAdapter,
}));

import {
  readYoungCalendarFacts,
  readYoungSyncedAt,
} from "@/features/young/server/young-calendar-query";
import { buildYoungEventListQuery } from "@/features/young/server/young-event-query";

beforeEach(() => {
  vi.resetAllMocks();
  withAdapter.mockImplementation(async (_database, action) =>
    action({ queryRaw }),
  );
  queryRaw.mockImplementation(async ({ sql }) => ({
    rows: sql.includes("COUNT(*)") ? [["7"]] : [],
  }));
});

describe("Young fixed calendar queries", () => {
  it("binds hostile filters and Shanghai bounds without restricting the unknown count to the range", async () => {
    const search = "%' OR true --";
    const query = buildYoungEventListQuery({
      search,
      organizerId: "owner'",
      active: false,
      category: " Reading ",
      module: "智",
      activityLevel: "校级",
      dateFrom: "2035-09-15",
      dateTo: "2035-09-15",
      timeBasis: "registration",
    });
    expect(await readYoungCalendarFacts(query)).toEqual({
      data: [],
      unknownDateCount: 7,
    });
    expect(withAdapter).toHaveBeenCalledWith("app", expect.any(Function));
    expect(queryRaw).toHaveBeenCalledTimes(2);
    const [events, count] = queryRaw.mock.calls.map(([value]) => value);
    expect(events.sql).not.toContain(search);
    expect(events.sql).not.toContain("owner'");
    expect(events.args).toEqual([
      false,
      "Reading",
      "智",
      "校级",
      "owner'",
      `%${search}%`,
      "2035-09-15T15:59:59.999Z",
      "2035-09-14T16:00:00.000Z",
    ]);
    expect(events.sql).toContain('"applyStartAt" <= $7::timestamp');
    expect(events.sql).toContain(
      '("applyEndAt" > $8::timestamp OR "applyStartAt" >= $8::timestamp)',
    );
    expect(events.sql).toContain('ORDER BY "applyStartAt" ASC, "youngId" ASC');
    expect(count.args).toEqual(events.args.slice(0, 6));
    expect(count.sql).toContain('"applyStartAt" IS NULL');
    expect(count.sql).not.toContain("::timestamp");
  });

  it("decodes only the eight public fields with nullable UTC timestamps", async () => {
    queryRaw.mockResolvedValueOnce({
      rows: [
        [
          "42",
          "Event",
          "2035-09-15T02:00:00+00:00",
          null,
          null,
          "2035-09-14T03:00:00+00:00",
          null,
          true,
        ],
      ],
    });
    const result = await readYoungCalendarFacts(
      buildYoungEventListQuery({
        dateFrom: "2035-09-15",
        dateTo: "2035-09-15",
      }),
    );
    expect(result.data).toEqual([
      {
        youngId: "42",
        name: "Event",
        startAt: "2035-09-15T10:00:00+08:00",
        endAt: null,
        applyStartAt: null,
        applyEndAt: "2035-09-14T11:00:00+08:00",
        location: null,
        sourceMissing: true,
      },
    ]);
  });

  it("rejects malformed driver values instead of caching corrupt facts", async () => {
    queryRaw
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [["9007199254740992"]] });
    await expect(
      readYoungCalendarFacts(buildYoungEventListQuery({})),
    ).rejects.toThrow("Invalid Young unknown-date count");
    queryRaw.mockResolvedValueOnce({
      rows: [["42", "Event", "invalid", null, null, null, null, false]],
    });
    await expect(
      readYoungCalendarFacts(buildYoungEventListQuery({})),
    ).rejects.toThrow("Invalid Young event timestamp");
  });

  it("reads the optional source timestamp without an ORM client", async () => {
    queryRaw.mockResolvedValueOnce({ rows: [] });
    expect(await readYoungSyncedAt()).toBeNull();
    queryRaw.mockResolvedValueOnce({ rows: [[null]] });
    expect(await readYoungSyncedAt()).toBeNull();
    queryRaw.mockResolvedValueOnce({ rows: [["2035-09-15T02:00:00+00:00"]] });
    expect(await readYoungSyncedAt()).toBe(Date.parse("2035-09-15T02:00:00Z"));
    queryRaw.mockResolvedValueOnce({ rows: [["invalid"]] });
    await expect(readYoungSyncedAt()).rejects.toThrow(
      "Invalid Young event timestamp",
    );
  });
});
