import { describe, expect } from "vitest";
import {
  getYoungOrganizer,
  listYoungEvents,
} from "@/features/young/server/young-event-service";
import { isolatedNodeTest } from "../shared/isolated-node-fixture";

const it = isolatedNodeTest.extend(
  "catalog",
  async ({ isolatedDatabase: { owner: db }, nodeRuntime }) =>
    nodeRuntime.run(async () => {
      const marker = crypto.randomUUID();
      const organizerId = `young-catalog-${marker}`;
      const id = (suffix: string) => `${organizerId}-${suffix}`;
      await db.$transaction(async (fixture) => {
        // Isolate production L1 cache keys without clearing another case's cache.
        await fixture.staticImportState.create({
          data: {
            id: "global",
            snapshotSha256: marker.replaceAll("-", "").repeat(2),
            snapshotGeneratedAt: new Date(),
            transformRevision: 6,
          },
        });
        await fixture.youngOrganizer.create({
          data: {
            id: organizerId,
            name: "Calendar fixture",
            normalizedName: organizerId,
          },
        });
        const date = (value: string) => new Date(`2035-09-${value}+08:00`);
        const records = [
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
          { youngId: id("point"), startAt: date("15T10:00:00"), endAt: null },
          { youngId: id("unknown"), startAt: null, endAt: null },
          {
            youngId: id("registration"),
            startAt: date("20T10:00:00"),
            endAt: date("20T12:00:00"),
            applyStartAt: date("15T10:00:00"),
            applyEndAt: null,
          },
        ];
        await fixture.youngEvent.createMany({
          data: records.map((row) => ({
            ...row,
            organizerId,
            name: row.youngId,
            rawJson: {},
            isActive: true,
          })),
        });
      });
      return { organizerId, id };
    }),
);

describe("Young public date filters and bounded organizer summaries", () => {
  it("young-event.date-range-overlap", async ({ catalog, nodeRuntime }) => {
    await nodeRuntime.run(async () => {
      const { organizerId, id } = catalog;
      const page = await listYoungEvents({
        organizerId,
        dateFrom: "2035-09-15",
        dateTo: "2035-09-15",
      });
      expect(page.data.map((row) => row.youngId).sort()).toEqual(
        [id("overnight"), id("point")].sort(),
      );
      expect(page.unknownDateCount).toBe(1);
      const registration = await listYoungEvents({
        organizerId,
        dateFrom: "2035-09-15",
        dateTo: "2035-09-15",
        timeBasis: "registration",
      });
      expect(registration.data.map((row) => row.youngId)).toEqual([
        id("registration"),
      ]);
    });
  });
  it("young-event.unknown-date-results", async ({ catalog, nodeRuntime }) => {
    await nodeRuntime.run(async () => {
      const { organizerId, id } = catalog;
      const page = await listYoungEvents({
        organizerId,
        dateFrom: "2035-09-15",
        dateTo: "2035-09-15",
        timeBasis: "registration",
      });
      expect(page.data.map((row) => row.youngId)).toEqual([id("registration")]);
      expect(page.unknownDateCount).toBe(4);
      const unknown = await listYoungEvents({
        organizerId,
        timeBasis: "registration",
        dateUnknown: true,
        pageSize: 2,
        page: 2,
      });
      expect(unknown.pagination).toEqual({
        page: 2,
        pageSize: 2,
        total: 4,
        totalPages: 2,
      });
      expect(unknown.data).toHaveLength(2);
      const first = await listYoungEvents({
        organizerId,
        timeBasis: "registration",
        dateUnknown: true,
        pageSize: 2,
        page: 1,
      });
      expect(first.pagination.total).toBe(4);
      const all = [...first.data, ...unknown.data];
      expect(new Set(all.map((event) => event.youngId)).size).toBe(4);
      expect(all.every((event) => event.applyStartAt === null)).toBe(true);
      expect(all.map((event) => event.youngId).sort()).toEqual(
        ["overnight", "midnight-end", "point", "unknown"].map(id).sort(),
      );
      const activityUnknown = await listYoungEvents({
        organizerId,
        dateUnknown: true,
      });
      expect(activityUnknown.data.map((event) => event.youngId)).toEqual([
        id("unknown"),
      ]);
      expect(activityUnknown.pagination.total).toBe(1);
    });
  });
  it("returns counts without embedding the full history", async ({
    catalog,
    nodeRuntime,
  }) => {
    await nodeRuntime.run(async () => {
      const { organizerId } = catalog;
      const organizer = await getYoungOrganizer(organizerId);
      expect(organizer).toMatchObject({
        id: organizerId,
        totalCount: 5,
        activeCount: 5,
        upcomingCount: 4,
        historyCount: 0,
      });
      expect(Object.keys(organizer ?? {})).toEqual([
        "id",
        "name",
        "normalizedName",
        "totalCount",
        "activeCount",
        "upcomingCount",
        "historyCount",
      ]);
    });
  });
});
