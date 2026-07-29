import { beforeEach, describe, expect, it, vi } from "vitest";

const { courseFindManyMock, courseFindUniqueMock, teacherFindUniqueMock } =
  vi.hoisted(() => ({
    courseFindManyMock: vi.fn(),
    courseFindUniqueMock: vi.fn(),
    teacherFindUniqueMock: vi.fn(),
  }));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    course: {
      findMany: courseFindManyMock,
      findUnique: courseFindUniqueMock,
    },
    teacher: { findUnique: teacherFindUniqueMock },
  }),
}));

describe("catalog detail page data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads a course without unused comment queries", async () => {
    const course = {
      _count: { sections: 3 },
      code: "MATH1001",
      id: 11,
      jwId: 101,
      sections: [],
    };
    courseFindManyMock.mockResolvedValue([
      { aliases: [], id: course.id, jwId: course.jwId },
    ]);
    courseFindUniqueMock.mockResolvedValue(course);

    const { getCoursePage } = await import(
      "@/features/catalog/server/course-page-data"
    );
    const result = await getCoursePage(course.jwId, "zh-cn", {
      includeSections: false,
    });

    expect(result).toEqual({
      code: course.code,
      id: course.id,
      jwId: course.jwId,
      sectionCount: 3,
      sections: [],
    });
    const courseSelect = courseFindUniqueMock.mock.calls[0]?.[0]?.select;
    expect(courseSelect).not.toHaveProperty("description");
    expect(courseSelect?.sections).toBe(false);
    expect(result).not.toHaveProperty("commentCount");
    expect(result).not.toHaveProperty("latestComments");
  });

  it("loads a teacher without unused comment queries", async () => {
    const teacher = {
      _count: { sections: 2 },
      id: 21,
      namePrimary: "Ada",
      sections: [],
    };
    teacherFindUniqueMock.mockResolvedValue(teacher);

    const { getTeacherPage } = await import(
      "@/features/catalog/server/teacher-page-data"
    );
    const result = await getTeacherPage(teacher.id, "zh-cn", {
      includeSections: false,
    });

    expect(result).toEqual({
      id: teacher.id,
      namePrimary: teacher.namePrimary,
      sectionCount: 2,
      sections: [],
    });
    const teacherSelect = teacherFindUniqueMock.mock.calls[0]?.[0]?.select;
    expect(teacherSelect).not.toHaveProperty("description");
    expect(teacherSelect?.sections).toBe(false);
    expect(result).not.toHaveProperty("commentCount");
    expect(result).not.toHaveProperty("latestComments");
  });

  it("strips Prisma extension symbols before returning load data", async () => {
    const localizedNameSymbol = Symbol("localizedName");
    const courseSections = [{ code: "001", jwId: 301 }];
    courseFindManyMock.mockResolvedValue([{ aliases: [], id: 11, jwId: 101 }]);
    courseFindUniqueMock.mockResolvedValue({
      _count: { sections: 1 },
      id: 11,
      jwId: 101,
      [localizedNameSymbol]: "course",
      sections: courseSections,
    });
    const teacherSections = [{ code: "002", jwId: 302 }];
    teacherFindUniqueMock.mockResolvedValue({
      _count: { sections: 1 },
      id: 21,
      [localizedNameSymbol]: "teacher",
      sections: teacherSections,
    });

    const [{ getCoursePage }, { getTeacherPage }] = await Promise.all([
      import("@/features/catalog/server/course-page-data"),
      import("@/features/catalog/server/teacher-page-data"),
    ]);
    const [courseResult, teacherResult] = await Promise.all([
      getCoursePage(101),
      getTeacherPage(21),
    ]);

    expect(courseResult?.sections).toEqual(courseSections);
    expect(teacherResult?.sections).toEqual(teacherSections);
    expect(Reflect.ownKeys(courseResult ?? {})).not.toContain(
      localizedNameSymbol,
    );
    expect(Reflect.ownKeys(teacherResult ?? {})).not.toContain(
      localizedNameSymbol,
    );
  });
});
