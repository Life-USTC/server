import { beforeEach, describe, expect, it, vi } from "vitest";

const { youngEventMock, youngOrganizerMock, staticImportStateMock } =
  vi.hoisted(() => ({
    youngEventMock: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    youngOrganizerMock: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    staticImportStateMock: {
      findUnique: vi.fn(),
    },
  }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    youngEvent: youngEventMock,
    youngOrganizer: youngOrganizerMock,
    staticImportState: staticImportStateMock,
  },
}));

import {
  getYoungEvent,
  getYoungOrganizer,
  listYoungEventCategories,
  listYoungEvents,
  listYoungOrganizers,
} from "@/features/young/server/young-event-service";

const RECORD = {
  youngId: "42",
  name: "秋日读书会",
  category: "单次项目",
  department: "校团委",
  organizer: "学生会",
  status: "进行中",
  registrationStatus: "报名中",
  location: "东区图书馆",
  imageUrl: null,
  hours: 2.5,
  capacity: 30,
  appliedCount: 12,
  startAt: new Date("2026-09-10T06:00:00.000Z"),
  endAt: null,
  applyStartAt: null,
  applyEndAt: null,
  isActive: true,
  organizerId: "organizer-1",
  sourceMissing: false,
  lastSeenAt: null,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  staticImportStateMock.findUnique.mockResolvedValue(null);
});

describe("young event service", () => {
  it("lists events with filters, ordering, and pagination metadata", async () => {
    youngEventMock.count.mockResolvedValue(21);
    youngEventMock.findMany.mockResolvedValue([RECORD]);

    const result = await listYoungEvents({
      active: true,
      category: "单次项目",
      search: "读书",
      page: 2,
      pageSize: 20,
    });

    expect(youngEventMock.count).toHaveBeenCalledWith({
      where: {
        isActive: true,
        category: "单次项目",
        name: { contains: "读书", mode: "insensitive" },
      },
    });
    expect(youngEventMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { isActive: "desc" },
          { startAt: { sort: "desc", nulls: "last" } },
          { youngId: "asc" },
        ],
        skip: 20,
        take: 20,
      }),
    );
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 20,
      total: 21,
      totalPages: 2,
    });
    expect(result.data[0]).toMatchObject({
      youngId: "42",
      name: "秋日读书会",
      isActive: true,
      startAt: "2026-09-10T14:00:00+08:00",
      endAt: null,
    });
  });

  it("returns null detail for unknown youngId", async () => {
    youngEventMock.findUnique.mockResolvedValue(null);
    await expect(getYoungEvent("missing")).resolves.toBeNull();
  });

  it("includes rawJson in detail results", async () => {
    youngEventMock.findUnique.mockResolvedValue({
      ...RECORD,
      rawJson: { id: 42, itemName: "秋日读书会" },
    });

    const event = await getYoungEvent("42");
    expect(event?.youngId).toBe("42");
    expect(event?.rawJson).toEqual({ id: 42, itemName: "秋日读书会" });
  });

  it("maps a stored pic path to the local image proxy URL", async () => {
    const withImage = {
      ...RECORD,
      imageUrl: "group1/M00/31/B5/wKgUEWpR3ciAJX_MAABnEoFLBaI860.jpg",
    };
    youngEventMock.findMany.mockResolvedValue([withImage]);
    youngEventMock.count.mockResolvedValue(1);
    youngEventMock.findUnique.mockResolvedValue({ ...withImage, rawJson: {} });

    const listed = await listYoungEvents();
    expect(listed.data[0]?.imageUrl).toBe("/api/catalog/young-events/42/image");

    const detail = await getYoungEvent("42");
    expect(detail?.imageUrl).toBe("/api/catalog/young-events/42/image");
  });

  it("keeps imageUrl null when the event has no poster", async () => {
    youngEventMock.findMany.mockResolvedValue([RECORD]);
    youngEventMock.count.mockResolvedValue(1);

    const listed = await listYoungEvents();
    expect(listed.data[0]?.imageUrl).toBeNull();
  });

  it("lists distinct non-null categories in order", async () => {
    youngEventMock.findMany.mockResolvedValue([
      { category: "单次项目" },
      { category: "系列项目" },
    ]);

    await expect(listYoungEventCategories()).resolves.toEqual([
      "单次项目",
      "系列项目",
    ]);
    expect(youngEventMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { category: { not: null } },
        distinct: ["category"],
      }),
    );
  });

  it("returns range overlaps and separates incomplete dates", async () => {
    youngEventMock.count.mockResolvedValue(1);
    youngEventMock.findMany
      .mockResolvedValueOnce([RECORD])
      .mockResolvedValueOnce([{ ...RECORD, youngId: "unknown", endAt: null }]);

    const result = await listYoungEvents({
      dateFrom: "2026-09-10",
      dateTo: "2026-09-11",
      timeBasis: "activity",
      page: 1,
      pageSize: 20,
    });

    expect(youngEventMock.count).toHaveBeenCalledWith({
      where: {
        AND: [
          {},
          {
            startAt: { not: null, lte: new Date("2026-09-11T15:59:59.999Z") },
            endAt: { not: null, gte: new Date("2026-09-09T16:00:00.000Z") },
          },
        ],
      },
    });
    expect(result.data.map(({ youngId }) => youngId)).toEqual(["42"]);
    expect(result.unknownDates.map(({ youngId }) => youngId)).toEqual([
      "unknown",
    ]);
  });

  it("groups organizer activities by active, upcoming, and history state", async () => {
    youngOrganizerMock.count.mockResolvedValue(1);
    youngOrganizerMock.findMany.mockResolvedValue([
      { id: "organizer-1", name: "学生会", normalizedName: "学生会" },
    ]);
    youngEventMock.findMany.mockResolvedValue([
      { ...RECORD, isActive: true, youngId: "active" },
      {
        ...RECORD,
        isActive: false,
        youngId: "upcoming",
        startAt: new Date("2099-09-10T06:00:00.000Z"),
        endAt: new Date("2099-09-10T08:00:00.000Z"),
      },
      {
        ...RECORD,
        isActive: false,
        youngId: "history",
        startAt: new Date("2020-09-10T06:00:00.000Z"),
        endAt: new Date("2020-09-10T08:00:00.000Z"),
      },
    ]);

    const listed = await listYoungOrganizers({ page: 1, pageSize: 20 });
    expect(listed.data[0]).toMatchObject({
      id: "organizer-1",
      activeCount: 1,
      upcomingCount: 1,
      historyCount: 1,
    });
    expect(listed.data[0]?.activeEvents[0]?.youngId).toBe("active");
    expect(listed.data[0]?.upcomingEvents[0]?.youngId).toBe("upcoming");
    expect(listed.data[0]?.historyEvents[0]?.youngId).toBe("history");
  });

  it("gets one organizer by its stable local ID", async () => {
    youngOrganizerMock.findUnique.mockResolvedValue({
      id: "organizer-1",
      name: "学生会",
      normalizedName: "学生会",
    });
    youngEventMock.findMany.mockResolvedValue([]);

    await expect(getYoungOrganizer("organizer-1")).resolves.toMatchObject({
      id: "organizer-1",
      name: "学生会",
      activeEvents: [],
      upcomingEvents: [],
      historyEvents: [],
    });
  });
});
