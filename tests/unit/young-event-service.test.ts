import { beforeEach, describe, expect, it, vi } from "vitest";

const { youngEventMock } = vi.hoisted(() => ({
  youngEventMock: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { youngEvent: youngEventMock },
}));

import {
  getYoungEvent,
  listYoungEventCategories,
  listYoungEvents,
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
};

beforeEach(() => {
  vi.clearAllMocks();
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
});
