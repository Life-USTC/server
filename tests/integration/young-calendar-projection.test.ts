import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { youngCalendarDays } from "@/features/young/lib/young-calendar";
import { youngCalendarConflicts } from "@/features/young/lib/young-calendar-conflicts";
import {
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
});
