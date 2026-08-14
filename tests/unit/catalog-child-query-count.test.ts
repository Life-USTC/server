import { beforeEach, describe, expect, it, vi } from "vitest";

const { examFindManyMock, scheduleFindManyMock, sectionFindUniqueMock } =
  vi.hoisted(() => ({
    examFindManyMock: vi.fn(),
    scheduleFindManyMock: vi.fn(),
    sectionFindUniqueMock: vi.fn(),
  }));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({
    exam: { findMany: examFindManyMock },
    schedule: { findMany: scheduleFindManyMock },
    section: { findUnique: sectionFindUniqueMock },
  })),
}));

describe("catalog child-record query count", () => {
  beforeEach(() => {
    examFindManyMock.mockReset();
    scheduleFindManyMock.mockReset();
    sectionFindUniqueMock.mockReset();
  });

  it("loads section context and bounded schedules in one top-level query", async () => {
    const dateFrom = new Date("2026-03-01T00:00:00.000Z");
    const dateTo = new Date("2026-04-01T00:00:00.000Z");
    sectionFindUniqueMock.mockResolvedValue({
      id: 1,
      jwId: 101,
      code: "CS101.01",
      course: { jwId: 11, code: "CS101", nameCn: "课程", nameEn: null },
      semester: { jwId: 22, code: "2026S", nameCn: "春" },
      schedules: [{ id: 9, startTime: 800, endTime: 930 }],
    });
    const { getSectionSchedulesByJwId } = await import(
      "@/features/catalog/server/schedule-read-model"
    );

    await expect(
      getSectionSchedulesByJwId({
        dateFrom,
        dateTo,
        includeSection: true,
        limit: 5,
        locale: "en-us",
        sectionJwId: 101,
      }),
    ).resolves.toMatchObject({
      found: true,
      schedules: [{ id: 9, startTime: "08:00", endTime: "09:30" }],
      section: { id: 1, jwId: 101 },
    });

    expect(sectionFindUniqueMock).toHaveBeenCalledOnce();
    expect(sectionFindUniqueMock).toHaveBeenCalledWith({
      where: { jwId: 101 },
      select: expect.objectContaining({
        schedules: expect.objectContaining({
          where: { date: { gte: dateFrom, lte: dateTo } },
          take: 5,
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          include: expect.objectContaining({ section: expect.any(Object) }),
        }),
      }),
    });
    expect(scheduleFindManyMock).not.toHaveBeenCalled();
  });

  it("keeps compact schedule items when includeSection is omitted", async () => {
    sectionFindUniqueMock.mockResolvedValue({
      id: 1,
      jwId: 101,
      code: "CS101.01",
      course: { jwId: 11, code: "CS101", nameCn: "课程", nameEn: null },
      semester: { jwId: 22, code: "2026S", nameCn: "春" },
      schedules: [],
    });
    const { getSectionSchedulesByJwId } = await import(
      "@/features/catalog/server/schedule-read-model"
    );

    await getSectionSchedulesByJwId({ sectionJwId: 101 });

    const schedulesSelection =
      sectionFindUniqueMock.mock.calls[0]?.[0].select.schedules;
    expect(schedulesSelection.include).not.toHaveProperty("section");
    expect(sectionFindUniqueMock).toHaveBeenCalledOnce();
    expect(scheduleFindManyMock).not.toHaveBeenCalled();
  });

  it("loads section context and ordered exams in one top-level query", async () => {
    sectionFindUniqueMock.mockResolvedValue({
      id: 1,
      jwId: 101,
      code: "CS101.01",
      course: { jwId: 11, code: "CS101", nameCn: "课程", nameEn: null },
      semester: { jwId: 22, code: "2026S", nameCn: "春" },
      exams: [{ id: 8, jwId: 88 }],
    });
    const { listExamsBySectionJwId } = await import(
      "@/features/catalog/server/section-exam-read-model"
    );

    await expect(listExamsBySectionJwId(101, "en-us")).resolves.toMatchObject({
      exams: [{ id: 8, jwId: 88 }],
      section: { id: 1, jwId: 101 },
    });

    expect(sectionFindUniqueMock).toHaveBeenCalledOnce();
    expect(sectionFindUniqueMock).toHaveBeenCalledWith({
      where: { jwId: 101 },
      select: expect.objectContaining({
        exams: expect.objectContaining({
          orderBy: [{ examDate: "asc" }, { startTime: "asc" }, { jwId: "asc" }],
        }),
      }),
    });
    expect(examFindManyMock).not.toHaveBeenCalled();
  });

  it("returns one-query misses without issuing child queries", async () => {
    sectionFindUniqueMock.mockResolvedValue(null);
    const { getSectionSchedulesByJwId } = await import(
      "@/features/catalog/server/schedule-read-model"
    );

    await expect(
      getSectionSchedulesByJwId({ sectionJwId: 404 }),
    ).resolves.toEqual({ found: false });
    expect(sectionFindUniqueMock).toHaveBeenCalledOnce();
    expect(scheduleFindManyMock).not.toHaveBeenCalled();
  });
});
