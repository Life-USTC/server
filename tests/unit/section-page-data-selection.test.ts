import { beforeEach, describe, expect, it, vi } from "vitest";

const { sectionFindUnique } = vi.hoisted(() => ({
  sectionFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    section: { findUnique: sectionFindUnique },
  }),
}));

function sectionRecord() {
  return {
    _count: { exams: 4, schedules: 18 },
    course: {
      _count: { sections: 42 },
      id: 10,
      jwId: 100,
      namePrimary: "Calculus",
      sections: [
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
        },
      ],
    },
    courseId: 10,
    description: {
      content: "Section description",
      id: "description-1",
      lastEditedAt: null,
      lastEditedBy: null,
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    },
    exams: [],
    id: 20,
    schedules: [],
    teachers: [],
  };
}

describe("section page data selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sectionFindUnique.mockResolvedValue(sectionRecord());
  });

  it("loads the stream page in one Prisma call with bounded related rows and description", async () => {
    const { getSectionPage } = await import(
      "@/features/section-detail/server/section-page-data"
    );

    const result = await getSectionPage(30, "zh-cn", {
      includeExams: true,
      includeRelated: true,
      includeSchedules: true,
      includeTeacherDepartments: true,
    });

    expect(sectionFindUnique).toHaveBeenCalledOnce();
    const select = sectionFindUnique.mock.calls[0]?.[0]?.select;
    expect(select.description).toEqual({
      select: expect.objectContaining({ content: true, id: true }),
    });
    expect(select.course.select.sections).toMatchObject({
      take: 20,
      where: { jwId: { not: 30 }, retiredAt: null },
    });
    expect(select.course.select._count).toEqual({
      select: {
        sections: {
          where: { jwId: { not: 30 }, retiredAt: null },
        },
      },
    });
    expect(result).toMatchObject({
      description: {
        content: "Section description",
        id: "description-1",
      },
      section: {
        examCount: 4,
        otherCourseSectionCount: 42,
        scheduleCount: 18,
      },
    });
    expect(result?.section.otherCourseSections).toEqual([
      expect.objectContaining({
        jwId: 31,
        semester: {
          endDate: "2026-07-01T00:00:00.000Z",
          nameCn: "2026春",
          startDate: "2026-02-01T00:00:00.000Z",
        },
      }),
    ]);
    expect(result).toMatchInlineSnapshot(`
      {
        "description": {
          "content": "Section description",
          "id": "description-1",
          "lastEditedAt": null,
          "lastEditedBy": null,
          "renderedHtml": "<p>Section description</p>",
          "updatedAt": "2026-03-01T08:00:00+08:00",
        },
        "section": {
          "course": {
            "id": 10,
            "jwId": 100,
            "namePrimary": "Calculus",
          },
          "courseId": 10,
          "examCount": 4,
          "exams": [],
          "id": 20,
          "otherCourseSectionCount": 42,
          "otherCourseSections": [
            {
              "code": "002",
              "id": 21,
              "jwId": 31,
              "semester": {
                "endDate": "2026-07-01T00:00:00.000Z",
                "nameCn": "2026春",
                "startDate": "2026-02-01T00:00:00.000Z",
              },
              "semesterId": 20261,
              "teachers": [],
            },
          ],
          "scheduleCount": 18,
          "schedules": [],
          "teachers": [],
        },
      }
    `);
  });

  it("skips tab-only relations while preserving navigation counts", async () => {
    sectionFindUnique.mockResolvedValue({
      ...sectionRecord(),
      course: { id: 10, jwId: 100, namePrimary: "Calculus" },
    });
    const { getSectionPage } = await import(
      "@/features/section-detail/server/section-page-data"
    );

    const result = await getSectionPage(30, "zh-cn", {
      includeExams: false,
      includeRelated: false,
      includeSchedules: false,
    });

    const select = sectionFindUnique.mock.calls[0]?.[0]?.select;
    expect(select.exams).toBe(false);
    expect(select.schedules).toBe(false);
    expect(select.course.select).not.toHaveProperty("sections");
    expect(select.teachers).toEqual({
      select: {
        id: true,
        nameCn: true,
        nameEn: true,
        namePrimary: true,
        nameSecondary: true,
      },
    });
    expect(result?.section).toMatchObject({
      examCount: 4,
      exams: [],
      otherCourseSectionCount: 0,
      otherCourseSections: [],
      scheduleCount: 18,
      schedules: [],
    });
  });

  it("loads teacher departments only when requested", async () => {
    sectionFindUnique.mockResolvedValue({
      ...sectionRecord(),
      course: { id: 10, jwId: 100, namePrimary: "Calculus" },
    });
    const { getSectionPage } = await import(
      "@/features/section-detail/server/section-page-data"
    );

    await getSectionPage(30, "zh-cn", {
      includeRelated: false,
      includeTeacherDepartments: true,
    });

    expect(sectionFindUnique.mock.calls[0]?.[0]?.select.teachers).toEqual({
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

  it("returns JSON-clean page data", async () => {
    const localizedNameSymbol = Symbol("localizedName");
    sectionFindUnique.mockResolvedValue({
      ...sectionRecord(),
      [localizedNameSymbol]: "section",
    });
    const { getSectionPage } = await import(
      "@/features/section-detail/server/section-page-data"
    );

    const result = await getSectionPage(30, "zh-cn");

    expect(Reflect.ownKeys(result?.section ?? {})).not.toContain(
      localizedNameSymbol,
    );
  });
});
