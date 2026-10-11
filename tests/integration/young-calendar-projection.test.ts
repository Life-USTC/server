import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { youngCalendarDays } from "@/features/young/lib/young-calendar";
import { youngCalendarConflicts } from "@/features/young/lib/young-calendar-conflicts";
import {
  getYoungSourceFreshness,
  listYoungCalendarEvents,
  listYoungEvents,
} from "@/features/young/server/young-event-service";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = `calendar-projection-${crypto.randomUUID()}`;
const id = (suffix: string) => `${marker}-${suffix}`;
const date = (value: string) => new Date(`2035-09-${value}+08:00`);
const input = {
  organizerId: marker,
  search: marker,
  active: true,
  category: "Reading",
  module: "智",
  activityLevel: "校级",
  dateFrom: "2035-09-15",
  dateTo: "2035-09-15",
};

beforeAll(async () => {
  resetPublicRuntimeCacheForTest();
  await db.youngOrganizer.create({
    data: { id: marker, name: marker, normalizedName: marker },
  });
  const rows = [
    ...Array.from({ length: 205 }, (_, index) => ({
      youngId: id(`tie-${String(index).padStart(3, "0")}`),
      startAt: date("15T10:00:00"),
      endAt: date("15T12:00:00"),
      applyStartAt: date("10T08:00:00"),
      applyEndAt: date("10T09:00:00"),
    })),
    {
      youngId: id("overnight"),
      startAt: date("14T23:00:00"),
      endAt: date("15T01:00:00"),
    },
    {
      youngId: id("midnight-end"),
      startAt: date("14T23:00:00"),
      endAt: date("15T00:00:00"),
    },
    {
      youngId: id("late-point"),
      startAt: date("15T23:59:59"),
      endAt: null,
    },
    { youngId: id("unknown"), startAt: null, endAt: null },
    {
      youngId: id("registration"),
      startAt: date("20T10:00:00"),
      endAt: date("20T12:00:00"),
      applyStartAt: date("15T09:00:00"),
      applyEndAt: date("15T11:00:00"),
    },
    {
      youngId: id("inactive"),
      startAt: date("15T13:00:00"),
      endAt: null,
      isActive: false,
    },
  ];
  await db.youngEvent.createMany({
    data: rows.map((row) => ({
      name: row.youngId,
      organizerId: marker,
      category: "Reading",
      module: "智",
      activityLevel: "校级",
      location: "Library",
      sourceMissing: true,
      contactName: "Not needed by calendar",
      contactTel: "fixture-only",
      rawJson: {},
      isActive: true,
      ...row,
    })),
  });
  await db.youngEvent.createMany({
    data: [
      ["percent", "Literal 100%"],
      ["percent-wildcard", "Literal 100x"],
      ["underscore", "under_score"],
      ["underscore-wildcard", "underXscore"],
      ["backslash", String.raw`slash\path`],
      ["no-backslash", "slashpath"],
      ["unicode", "MixedCase 中文"],
      ["quoted", "quoted' OR true --"],
    ].map(([suffix, name]) => ({
      youngId: id(suffix),
      name,
      organizerId: marker,
      category: "Pattern",
      startAt: date("15T10:00:00"),
      endAt: null,
      isActive: true,
      rawJson: {},
    })),
  });
  await db.youngEvent.create({
    data: {
      youngId: id("pattern-unknown"),
      name: "Literal 100% Unknown",
      organizerId: marker,
      category: "Pattern",
      isActive: true,
      rawJson: {},
    },
  });
});

afterAll(async () => {
  await db.youngEvent.deleteMany({ where: { organizerId: marker } });
  await db.youngOrganizer.delete({ where: { id: marker } });
  await db.$disconnect();
});

describe("compact public calendar projection", () => {
  it("preserves more than two list pages, overlap, Shanghai end-of-day and stable ordering", async () => {
    const result = await listYoungCalendarEvents(input);
    const expectedIds = [
      id("overnight"),
      ...Array.from({ length: 205 }, (_, index) =>
        id(`tie-${String(index).padStart(3, "0")}`),
      ),
      id("late-point"),
    ];
    expect(result.data.map((event) => event.youngId)).toEqual(expectedIds);
    expect(result.unknownDateCount).toBe(1);
    expect(result.data[0]).toEqual({
      youngId: id("overnight"),
      name: id("overnight"),
      location: "Library",
      sourceMissing: true,
      startAt: "2035-09-14T23:00:00+08:00",
      endAt: "2035-09-15T01:00:00+08:00",
      applyStartAt: null,
      applyEndAt: null,
    });
    expect(result.data.every((event) => Object.keys(event).length === 8)).toBe(
      true,
    );
    const days = youngCalendarDays(
      "day",
      { start: input.dateFrom, end: input.dateTo },
      result.data,
      date("15T00:00:00"),
    );
    expect(days[0]?.events).toHaveLength(207);
    expect(days[0]?.startingEvents).toHaveLength(206);
    const conflicts = youngCalendarConflicts(result.data, [
      {
        id: "occupied",
        title: "Class",
        location: null,
        url: "/workspace/calendar",
        youngId: null,
        type: "schedule",
        at: "2035-09-15T11:00:00+08:00",
        endsAt: "2035-09-15T11:30:00+08:00",
      },
    ]);
    expect(conflicts.size).toBe(205);
    expect(conflicts.has(id("overnight"))).toBe(false);
  });

  it("keeps registration filters and unknown dates separate from activity dates", async () => {
    const result = await listYoungCalendarEvents({
      ...input,
      timeBasis: "registration",
    });
    expect(result.data.map((event) => event.youngId)).toEqual([
      id("registration"),
    ]);
    expect(result.unknownDateCount).toBe(4);
    expect(result.data[0]?.applyStartAt).toBe("2035-09-15T09:00:00+08:00");
    for (const filters of [
      { category: "Other" },
      { module: "体" },
      { activityLevel: "院级" },
      { search: "No matching title" },
      { organizerId: `${marker}-missing` },
    ]) {
      const empty = await listYoungCalendarEvents({ ...input, ...filters });
      expect(empty.data).toEqual([]);
      expect(empty.unknownDateCount).toBe(0);
    }
    const inactive = await listYoungCalendarEvents({ ...input, active: false });
    expect(inactive.data.map((event) => event.youngId)).toEqual([
      id("inactive"),
    ]);
  });

  it("leaves full public list fields and pagination intact after warming calendar facts", async () => {
    await listYoungCalendarEvents(input);
    const list = await listYoungEvents({ ...input, page: 3, pageSize: 100 });
    expect(list.pagination).toEqual({
      page: 3,
      pageSize: 100,
      total: 207,
      totalPages: 3,
    });
    expect(list.data).toHaveLength(7);
    expect(list.data[0]).toHaveProperty(
      "contactName",
      "Not needed by calendar",
    );
    expect(list.data[0]).toHaveProperty("contactTel", "fixture-only");
    expect(list.unknownDateCount).toBe(1);
  });
  it("matches Prisma search wildcards, escapes, Unicode and bound quotes", async () => {
    const cases: [string, string[], number][] = [
      ["100%", ["percent", "percent-wildcard"], 1],
      ["under_score", ["underscore", "underscore-wildcard"], 0],
      [String.raw`slash\path`, ["no-backslash"], 0],
      [String.raw`slash\\path`, ["backslash"], 0],
      [String.raw`\%`, ["percent"], 1],
      [String.raw`\_`, ["underscore"], 0],
      ["mixedcase 中文", ["unicode"], 0],
      ["' OR true --", ["quoted"], 0],
    ];
    for (const [search, suffixes, unknownDateCount] of cases) {
      const filters = {
        organizerId: marker,
        category: "Pattern",
        search,
        dateFrom: "2035-09-15",
        dateTo: "2035-09-15",
      };
      const calendar = await listYoungCalendarEvents(filters);
      const list = await listYoungEvents({ ...filters, pageSize: 100 });
      const ids = suffixes.map(id).sort();
      expect(
        calendar.data.map((row) => row.youngId),
        search,
      ).toEqual(ids);
      expect(
        list.data.map((row) => row.youngId),
        search,
      ).toEqual(ids);
      expect(calendar.unknownDateCount, search).toBe(unknownDateCount);
      expect(list.unknownDateCount, search).toBe(unknownDateCount);
      expect(calendar.data).toEqual(
        list.data.map(
          ({
            youngId,
            name,
            startAt,
            endAt,
            applyStartAt,
            applyEndAt,
            location,
            sourceMissing,
          }) => ({
            youngId,
            name,
            startAt,
            endAt,
            applyStartAt,
            applyEndAt,
            location,
            sourceMissing,
          }),
        ),
      );
    }
  });

  it("refreshes calendar and source facts on a committed revision change", async () => {
    const original = await db.staticImportState.findUnique({
      where: { id: "global" },
    });
    const filters = { ...input, search: id("late-point") };
    const before = new Date("2035-09-01T00:00:00Z");
    const after = new Date("2035-09-02T00:00:00Z");
    try {
      await db.staticImportState.upsert({
        where: { id: "global" },
        create: {
          id: "global",
          snapshotSha256: "a".repeat(64),
          youngSyncedAt: before,
          snapshotGeneratedAt: before,
          transformRevision: 1,
        },
        update: {
          youngSyncedAt: before,
          updatedAt: new Date("2035-09-01T00:00:00Z"),
        },
      });
      resetPublicRuntimeCacheForTest();
      const first = await listYoungCalendarEvents(filters);
      expect(first.data[0]?.name).toBe(id("late-point"));
      expect(first.source.lastSyncedAt).toBe("2035-09-01T08:00:00+08:00");
      await db.$transaction([
        db.youngEvent.update({
          where: { youngId: id("late-point") },
          data: { location: "Changed location" },
        }),
        db.staticImportState.update({
          where: { id: "global" },
          data: {
            youngSyncedAt: after,
            updatedAt: new Date("2035-09-02T00:00:00Z"),
          },
        }),
      ]);
      const next = await listYoungCalendarEvents(filters);
      expect(next.data[0]?.location).toBe("Changed location");
      expect(next.source.lastSyncedAt).toBe("2035-09-02T08:00:00+08:00");
      expect((await getYoungSourceFreshness()).lastSyncedAt).toBe(
        next.source.lastSyncedAt,
      );
    } finally {
      await db.youngEvent.update({
        where: { youngId: id("late-point") },
        data: { location: "Library" },
      });
      if (original)
        await db.staticImportState.update({
          where: { id: "global" },
          data: original,
        });
      else await db.staticImportState.deleteMany({ where: { id: "global" } });
      resetPublicRuntimeCacheForTest();
    }
  });
});
