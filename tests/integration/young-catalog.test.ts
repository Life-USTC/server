import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getYoungOrganizer,
  listYoungEvents,
} from "@/features/young/server/young-event-service";
import { createFixturePrisma } from "../shared/prisma";

const fixture = createFixturePrisma();
const organizerId = `young-catalog-${crypto.randomUUID()}`;
const id = (suffix: string) => `${organizerId}-${suffix}`;
describe("Young public date filters and bounded organizer summaries", () => {
  beforeAll(async () => {
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
  afterAll(async () => {
    await fixture.youngEvent.deleteMany({ where: { organizerId } });
    await fixture.youngOrganizer.delete({ where: { id: organizerId } });
    await fixture.$disconnect();
  });
  it("includes overnight and point events, excludes an event ending at day start", async () => {
    const page = await listYoungEvents({
      organizerId,
      dateFrom: "2035-09-15",
      dateTo: "2035-09-15",
    });
    expect(page.data.map((row) => row.youngId).sort()).toEqual(
      [id("overnight"), id("point")].sort(),
    );
    expect(page.unknownDateCount).toBe(1);
  });
  it("uses registration dates independently, paginating missing start times", async () => {
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
  });
  it("returns counts without embedding the full history", async () => {
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
