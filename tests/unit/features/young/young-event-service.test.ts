import { beforeEach, describe, expect, it, vi } from "vitest";

const { youngEventMock, youngOrganizerMock, staticImportStateMock } =
  vi.hoisted(() => ({
    youngEventMock: {
      groupBy: vi.fn(),
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
  activityStatusCode: "26",
  signupStatusCode: "26",
  requiresSignup: true,
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
  activityLevel: "院级",
  module: "美",
  form: "现场参与",
  grades: "1,2",
  sponsor: "校团委",
  contactName: "张三",
  contactTel: "13800000000",
  duration: 2.5,
  serviceHour: 1.5,
  sumHours: 76,
  sumPersons: 27,
  partakeNum: 30,
  favCount: 4,
  limitNum: 50,
  createdAtUpstream: new Date("2026-08-08T15:53:40.000Z"),
  auditedAt: null,
  updatedAtUpstream: null,
  places: [
    {
      placeInfo: "东区礼堂",
      placeSt: "2026-08-20 14:00:00",
      placeEt: "2026-08-20 16:00:00",
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  youngEventMock.groupBy.mockResolvedValue([]);
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

  it("exposes the distinct activity and signup states", async () => {
    youngEventMock.count.mockResolvedValue(1);
    youngEventMock.findMany.mockResolvedValue([RECORD]);

    const event = (await listYoungEvents({})).data[0];
    expect(event).toMatchObject({
      activityLevel: "院级",
      activityStatusCode: "26",
      signupStatusCode: "26",
      requiresSignup: true,
      module: "美",
      form: "现场参与",
      grades: "1,2",
      sponsor: "校团委",
      contactName: "张三",
      contactTel: "13800000000",
      duration: 2.5,
      serviceHour: 1.5,
      sumHours: 76,
      sumPersons: 27,
      partakeNum: 30,
      favCount: 4,
      limitNum: 50,
      createdAtUpstream: "2026-08-08T23:53:40+08:00",
    });
    expect(event?.places).toEqual([
      {
        placeInfo: "东区礼堂",
        placeSt: "2026-08-20 14:00:00",
        placeEt: "2026-08-20 16:00:00",
      },
    ]);
    expect(event).not.toHaveProperty("registrationStatus");
  });

  it("narrows malformed places payloads to null", async () => {
    youngEventMock.count.mockResolvedValue(1);
    youngEventMock.findMany.mockResolvedValue([
      { ...RECORD, places: ["not-an-object", { placeEt: "only-end" }, 7] },
    ]);

    await expect(
      listYoungEvents({}).then((result) => result.data[0]?.places),
    ).resolves.toBeNull();
  });

  it("filters by module and activity level", async () => {
    youngEventMock.count.mockResolvedValue(0);
    youngEventMock.findMany.mockResolvedValue([]);

    await listYoungEvents({ module: "美", activityLevel: "院级" });

    expect(youngEventMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ module: "美", activityLevel: "院级" }),
      }),
    );
  });

  it("sanitizes detail rich text and proxies its inline images", async () => {
    youngEventMock.findUnique.mockResolvedValue({
      ...RECORD,
      rawJson: {},
      description:
        '<p onclick="alert(1)">介绍</p><img src="https://young.ustc.edu.cn/login/group1/M00/x.jpg"><script>alert(2)</script>',
      participationNotes: "<p>请提前十分钟到场。</p>",
    });

    const event = await getYoungEvent("42");
    expect(event?.description).toContain(
      'src="/api/catalog/young-events/images/group1/M00/x.jpg"',
    );
    expect(event?.description).not.toContain("onclick");
    expect(event?.description).not.toContain("script");
    expect(event?.participationNotes).toBe("<p>请提前十分钟到场。</p>");
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

  it("uses exclusive interval ends and counts unknown dates without loading them", async () => {
    youngEventMock.count.mockResolvedValueOnce(1).mockResolvedValueOnce(500);
    youngEventMock.findMany.mockResolvedValue([RECORD]);
    const result = await listYoungEvents({
      dateFrom: "2026-09-10",
      dateTo: "2026-09-11",
    });
    expect(youngEventMock.findMany).toHaveBeenCalledTimes(1);
    expect(youngEventMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {},
            {
              AND: [
                {
                  startAt: {
                    not: null,
                    lte: new Date("2026-09-11T15:59:59.999Z"),
                  },
                },
                {
                  OR: [
                    { endAt: { gt: new Date("2026-09-09T16:00:00Z") } },
                    { startAt: { gte: new Date("2026-09-09T16:00:00Z") } },
                  ],
                },
              ],
            },
          ],
        },
        take: 20,
      }),
    );
    expect(result.unknownDateCount).toBe(500);
    expect(result.data).toHaveLength(1);
  });

  it("paginates unknown registration dates", async () => {
    youngEventMock.count.mockResolvedValue(500);
    youngEventMock.findMany.mockResolvedValue([]);
    await listYoungEvents({
      dateUnknown: true,
      timeBasis: "registration",
      page: 2,
    });
    expect(youngEventMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{}, { applyStartAt: null }] },
        skip: 20,
        take: 20,
      }),
    );
    await expect(
      listYoungEvents({ dateUnknown: true, dateFrom: "2026-09-10" }),
    ).rejects.toThrow("Unknown-date");
  });

  it("returns organizer counts without loading activity histories", async () => {
    youngOrganizerMock.count.mockResolvedValue(1);
    youngOrganizerMock.findMany.mockResolvedValue([
      { id: "organizer-1", name: "学生会", normalizedName: "学生会" },
    ]);
    for (const count of [3000, 10, 20, 2900])
      youngEventMock.groupBy.mockResolvedValueOnce([
        { organizerId: "organizer-1", _count: { _all: count } },
      ]);
    const listed = await listYoungOrganizers({ page: 1, pageSize: 20 });
    expect(listed.data[0]).toEqual({
      id: "organizer-1",
      name: "学生会",
      normalizedName: "学生会",
      totalCount: 3000,
      activeCount: 10,
      upcomingCount: 20,
      historyCount: 2900,
    });
    expect(youngEventMock.findMany).not.toHaveBeenCalled();
    expect(youngEventMock.groupBy).toHaveBeenCalledTimes(4);
  });

  it("orders Web organizers across the active/inactive page boundary without skipping entries", async () => {
    youngOrganizerMock.count.mockResolvedValueOnce(8).mockResolvedValueOnce(3);
    youngOrganizerMock.findMany
      .mockResolvedValueOnce([
        { id: "active-last", name: "Z", normalizedName: "z" },
      ])
      .mockResolvedValueOnce([
        { id: "inactive-first", name: "A", normalizedName: "a" },
      ]);
    const result = await listYoungOrganizers({
      activeFirst: true,
      page: 2,
      pageSize: 2,
      search: "club",
    });
    expect(result.data.map((item) => item.id)).toEqual([
      "active-last",
      "inactive-first",
    ]);
    expect(youngOrganizerMock.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          AND: [
            { name: { contains: "club", mode: "insensitive" } },
            { events: { some: { isActive: true } } },
          ],
        },
        skip: 2,
        take: 1,
      }),
    );
    expect(youngOrganizerMock.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          AND: [
            { name: { contains: "club", mode: "insensitive" } },
            { events: { none: { isActive: true } } },
          ],
        },
        skip: 0,
        take: 1,
      }),
    );
    expect(result.pagination.total).toBe(8);
  });

  it("offsets later Web organizer pages inside the inactive group", async () => {
    youngOrganizerMock.count.mockResolvedValueOnce(8).mockResolvedValueOnce(3);
    youngOrganizerMock.findMany.mockResolvedValue([]);
    await listYoungOrganizers({ activeFirst: true, page: 3, pageSize: 2 });
    expect(youngOrganizerMock.findMany).toHaveBeenCalledTimes(1);
    expect(youngOrganizerMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, take: 2 }),
    );
  });

  it("gets one organizer by its stable local ID", async () => {
    youngOrganizerMock.findUnique.mockResolvedValue({
      id: "organizer-1",
      name: "学生会",
      normalizedName: "学生会",
    });
    await expect(getYoungOrganizer("organizer-1")).resolves.toMatchObject({
      id: "organizer-1",
      totalCount: 0,
      activeCount: 0,
      upcomingCount: 0,
      historyCount: 0,
    });
  });
});
