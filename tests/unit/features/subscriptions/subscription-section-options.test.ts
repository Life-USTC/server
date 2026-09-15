import { beforeEach, describe, expect, it, vi } from "vitest";

const { sectionFindManyMock } = vi.hoisted(() => ({
  sectionFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({ section: { findMany: sectionFindManyMock } })),
  withUserDbContext: vi.fn(),
}));

import { sectionOptionFromRow } from "@/features/subscriptions/server/subscription-read-model-shared";
import { listSubscribedSectionOptions } from "@/features/subscriptions/server/subscription-section-options";

describe("subscribed homework section options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sectionFindManyMock.mockResolvedValue([]);
  });

  it("serializes localized teachers and the next three actual class starts", () => {
    const result = sectionOptionFromRow(
      {
        id: 7,
        jwId: 7007,
        code: "001",
        course: { namePrimary: "Algorithms" },
        semester: {
          nameCn: "2026 秋",
          startDate: new Date("2026-09-01T00:00:00.000Z"),
          endDate: new Date("2027-01-20T00:00:00.000Z"),
        },
        schedules: [
          { date: new Date("2026-09-09T00:00:00.000Z"), startTime: 900 },
          { date: new Date("2026-09-11T00:00:00.000Z"), startTime: 900 },
          { date: new Date("2026-09-11T00:00:00.000Z"), startTime: 900 },
          { date: new Date("2026-09-12T00:00:00.000Z"), startTime: 1000 },
          { date: new Date("2026-09-13T00:00:00.000Z"), startTime: 1100 },
          { date: new Date("2026-09-14T00:00:00.000Z"), startTime: 1200 },
        ],
        teachers: [{ namePrimary: "Alice" }, { namePrimary: "Bob" }],
      },
      new Date("2026-09-10T02:00:00.000Z"),
    );

    expect(result).toMatchObject({
      courseName: "Algorithms",
      nextClassStarts: [
        "2026-09-11T09:00:00+08:00",
        "2026-09-12T10:00:00+08:00",
        "2026-09-13T11:00:00+08:00",
      ],
      teacherName: "Alice, Bob",
    });
  });

  it("filters earlier same-day classes before the bounded nested schedule take", async () => {
    await listSubscribedSectionOptions("user-1", "zh-cn", {
      sectionIds: [7],
    });

    const query = sectionFindManyMock.mock.calls[0]?.[0];
    const scheduleSelect = query?.select?.schedules;
    expect(scheduleSelect).toMatchObject({
      distinct: ["date", "startTime"],
      take: 3,
      where: {
        OR: [
          { date: { gte: expect.any(Date) } },
          {
            AND: [
              {
                date: {
                  gte: expect.any(Date),
                  lt: expect.any(Date),
                },
              },
              { startTime: { gt: expect.any(Number) } },
            ],
          },
        ],
      },
    });
  });
});
