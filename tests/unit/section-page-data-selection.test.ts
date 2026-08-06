import { beforeEach, describe, expect, it, vi } from "vitest";

const { sectionFindMany, sectionFindUnique } = vi.hoisted(() => ({
  sectionFindMany: vi.fn(),
  sectionFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    section: {
      findMany: sectionFindMany,
      findUnique: sectionFindUnique,
    },
  }),
}));

describe("section page data selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sectionFindMany.mockResolvedValue([]);
    sectionFindUnique.mockResolvedValue({
      _count: { exams: 4, schedules: 18 },
      courseId: 10,
      exams: [],
      id: 20,
      schedules: [],
      teachers: [],
    });
  });

  it("skips tab-only relations while preserving navigation counts", async () => {
    const { getSectionPage } = await import(
      "@/features/section-detail/server/section-page-data"
    );

    const result = await getSectionPage(30, "zh-cn", {
      includeExams: false,
      includeRelated: false,
      includeSchedules: false,
    });

    const select = sectionFindUnique.mock.calls[0]?.[0]?.select;
    expect(select).not.toHaveProperty("description");
    expect(select?.exams).toBe(false);
    expect(select?.schedules).toBe(false);
    expect(select?.teachers).toEqual({
      select: {
        id: true,
        nameCn: true,
        nameEn: true,
        namePrimary: true,
        nameSecondary: true,
      },
    });
    expect(result).toMatchObject({
      examCount: 4,
      exams: [],
      otherCourseSections: [],
      scheduleCount: 18,
      schedules: [],
    });
    expect(result).not.toHaveProperty("otherSections");
  });

  it("loads teacher departments only when the teachers tab is requested", async () => {
    const { getSectionPage } = await import(
      "@/features/section-detail/server/section-page-data"
    );

    await getSectionPage(30, "zh-cn", {
      includeExams: false,
      includeRelated: false,
      includeSchedules: false,
      includeTeacherDepartments: true,
    });

    const select = sectionFindUnique.mock.calls[0]?.[0]?.select;
    expect(select?.teachers).toEqual({
      select: {
        id: true,
        nameCn: true,
        nameEn: true,
        namePrimary: true,
        nameSecondary: true,
        department: {
          select: {
            nameCn: true,
            nameEn: true,
            namePrimary: true,
            nameSecondary: true,
          },
        },
      },
    });
  });

  it("returns a JSON-clean base shape before it can enter the public cache", async () => {
    const localizedNameSymbol = Symbol("localizedName");
    sectionFindUnique.mockResolvedValue({
      _count: { exams: 4, schedules: 18 },
      courseId: 10,
      exams: [],
      id: 20,
      schedules: [],
      teachers: [],
      [localizedNameSymbol]: "section",
    });
    const { getSectionPage } = await import(
      "@/features/section-detail/server/section-page-data"
    );

    const result = await getSectionPage(30, "zh-cn", {
      includeExams: false,
      includeRelated: false,
      includeSchedules: false,
    });

    expect(Reflect.ownKeys(result ?? {})).not.toContain(localizedNameSymbol);
  });

  it("sanitizes only related data when merging it into an already clean base", async () => {
    const localizedNameSymbol = Symbol("localizedName");
    sectionFindUnique.mockResolvedValue({
      _count: { exams: 4, schedules: 18 },
      course: { id: 10, jwId: 100, namePrimary: "Calculus" },
      courseId: 10,
      exams: [],
      id: 20,
      schedules: [],
      semesterId: 20261,
      teachers: [],
    });
    sectionFindMany.mockResolvedValue([
      {
        code: "002",
        id: 21,
        jwId: 31,
        semester: {
          endDate: new Date("2026-07-01T00:00:00.000Z"),
          nameCn: "2026春",
          startDate: new Date("2026-02-01T00:00:00.000Z"),
        },
        semesterId: 20261,
        teachers: [],
        [localizedNameSymbol]: "related section",
      },
    ]);
    const { getSectionPage, withSectionPageRelatedData } = await import(
      "@/features/section-detail/server/section-page-data"
    );
    const base = await getSectionPage(30, "zh-cn", {
      includeExams: false,
      includeRelated: false,
      includeSchedules: false,
    });
    if (!base) throw new Error("expected section base");

    const result = await withSectionPageRelatedData(base, "zh-cn");
    const related = result.otherCourseSections[0];

    expect(result).not.toBe(base);
    expect(result.course).toBe(base.course);
    expect(result.teachers).toBe(base.teachers);
    expect(result.exams).toBe(base.exams);
    expect(result.schedules).toBe(base.schedules);
    expect(related?.semester?.startDate).toBe("2026-02-01T00:00:00.000Z");
    expect(related?.semester?.endDate).toBe("2026-07-01T00:00:00.000Z");
    expect(Reflect.ownKeys(related ?? {})).not.toContain(localizedNameSymbol);
  });
});
