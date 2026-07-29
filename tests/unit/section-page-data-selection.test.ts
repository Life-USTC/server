import { beforeEach, describe, expect, it, vi } from "vitest";

const { sectionFindUnique } = vi.hoisted(() => ({
  sectionFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    section: { findUnique: sectionFindUnique },
  }),
}));

describe("section page data selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(result).toMatchObject({
      examCount: 4,
      exams: [],
      sameSemesterOtherTeachers: [],
      sameTeacherOtherSemesters: [],
      scheduleCount: 18,
      schedules: [],
    });
    expect(result).not.toHaveProperty("otherSections");
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
});
