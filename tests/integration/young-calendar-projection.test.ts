import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listPersonalCalendarPage } from "@/features/calendar/server/personal-calendar-page";
import { youngCalendarDays } from "@/features/young/lib/young-calendar";
import { youngCalendarConflicts } from "@/features/young/lib/young-calendar-conflicts";
import { youngEventConflictIntervals } from "@/features/young/lib/young-event-conflict-intervals";
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
      categoryCode: "0",
      formCode: "0",
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
  it("preserves more than two list pages, overlap, Shanghai end-of-day and stable ordering", {
    tags: ["@Young/Service"],
  }, async () => {
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
      conflictIntervals: [],
    });
    expect(result.data.every((event) => Object.keys(event).length === 9)).toBe(
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
        hasTime: true,
        conflictIntervals: [
          {
            startAt: "2035-09-15T11:00:00+08:00",
            endAt: "2035-09-15T11:30:00+08:00",
          },
        ],
      },
    ]);
    expect(conflicts.size).toBe(205);
    expect(conflicts.has(id("overnight"))).toBe(false);
  });

  it("projects the same known intervals through public SQL and private calendar reads", {
    tags: ["@Young/Service"],
  }, async () => {
    const ownerId = id("owner");
    const otherId = id("other");
    await db.user.createMany({
      data: [
        { id: ownerId, name: ownerId, email: `${ownerId}@example.test` },
        { id: otherId, name: otherId, email: `${otherId}@example.test` },
      ],
    });
    try {
      const rows = [
        {
          youngId: id("slots"),
          categoryCode: "1",
          startAt: date("14T00:00:00"),
          endAt: date("16T00:00:00"),
          places: [
            { placeSt: "2035-09-14 23:00:00", placeEt: "2035-09-15 01:00:00" },
            { placeSt: "2035-09-15 11:00:00", placeEt: "2035-09-15 12:00:00" },
          ],
        },
        {
          youngId: id("outside-slot"),
          places: [
            { placeSt: "2035-09-15 09:00:00", placeEt: "2035-09-15 11:00:00" },
          ],
        },
        {
          youngId: id("campaign"),
          formCode: "1",
          startAt: date("14T00:00:00"),
          endAt: date("16T00:00:00"),
        },
        {
          youngId: id("end-only"),
          places: [{ placeEt: "2035-09-15 11:00:00" }],
        },
        {
          youngId: id("invalid-slot"),
          places: [{ placeSt: 1000, placeEt: 1100 }],
        },
        { youngId: id("known") },
        { youngId: id("series"), categoryCode: "1" },
      ];
      for (const row of rows) {
        await db.youngEvent.create({
          data: {
            name: row.youngId,
            organizerId: marker,
            category: "Intervals",
            categoryCode: "0",
            formCode: "0",
            isActive: true,
            rawJson: {},
            startAt: date("15T10:00:00"),
            endAt: date("15T12:00:00"),
            ...row,
          },
        });
        await db.userYoungEventSubscription.create({
          data: { userId: ownerId, youngId: row.youngId, observedState: "{}" },
        });
      }
      const filters = { dateFrom: input.dateFrom, dateTo: input.dateTo };
      const publicRows = (
        await listYoungCalendarEvents({
          ...filters,
          organizerId: marker,
          category: "Intervals",
        })
      ).data;
      const privateRows = (await listPersonalCalendarPage(ownerId, filters))
        .data;
      expect(publicRows).toHaveLength(rows.length);
      expect(privateRows).toHaveLength(rows.length);
      for (const row of publicRows)
        expect(
          privateRows.find((item) => item.youngId === row.youngId)
            ?.conflictIntervals,
        ).toEqual(row.conflictIntervals);
      expect(
        publicRows.find((row) => row.youngId === id("slots"))
          ?.conflictIntervals,
      ).toEqual([
        {
          startAt: "2035-09-14T23:00:00+08:00",
          endAt: "2035-09-15T01:00:00+08:00",
        },
        {
          startAt: "2035-09-15T11:00:00+08:00",
          endAt: "2035-09-15T12:00:00+08:00",
        },
      ]);
      expect(
        publicRows.find((row) => row.youngId === id("known"))
          ?.conflictIntervals,
      ).toEqual([
        {
          startAt: "2035-09-15T10:00:00+08:00",
          endAt: "2035-09-15T12:00:00+08:00",
        },
      ]);
      for (const key of [
        "outside-slot",
        "campaign",
        "series",
        "end-only",
        "invalid-slot",
      ])
        expect(
          publicRows.find((row) => row.youngId === id(key))?.conflictIntervals,
        ).toEqual([]);
      expect((await listPersonalCalendarPage(otherId, filters)).data).toEqual(
        [],
      );
    } finally {
      await db.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    }
  });

  it("keeps registration filters and unknown dates separate from activity dates", {
    tags: ["@Young/Service"],
  }, async () => {
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

  it("leaves full public list fields and pagination intact after warming calendar facts", {
    tags: ["@Young/Service"],
  }, async () => {
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
  it("matches Prisma search wildcards, escapes, Unicode and bound quotes", {
    tags: ["@Young/Service"],
  }, async () => {
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
            categoryCode,
            formCode,
            places,
          }) => ({
            youngId,
            name,
            startAt,
            endAt,
            applyStartAt,
            applyEndAt,
            location,
            sourceMissing,
            conflictIntervals: youngEventConflictIntervals({
              startAt,
              endAt,
              categoryCode,
              formCode,
              places,
            }),
          }),
        ),
      );
    }
  });

  it("refreshes calendar and source facts on a committed revision change", {
    tags: ["@Young/Service"],
  }, async () => {
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
