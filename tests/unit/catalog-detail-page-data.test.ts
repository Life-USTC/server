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
    const course = { code: "MATH1001", id: 11, jwId: 101, sections: [] };
    courseFindManyMock.mockResolvedValue([
      { aliases: [], id: course.id, jwId: course.jwId },
    ]);
    courseFindUniqueMock.mockResolvedValue(course);

    const { getCoursePage } = await import(
      "@/features/catalog/server/course-page-data"
    );
    const result = await getCoursePage(course.jwId);

    expect(result).toEqual(course);
    expect(result).not.toHaveProperty("commentCount");
    expect(result).not.toHaveProperty("latestComments");
  });

  it("loads a teacher without unused comment queries", async () => {
    const teacher = { id: 21, namePrimary: "Ada", sections: [] };
    teacherFindUniqueMock.mockResolvedValue(teacher);

    const { getTeacherPage } = await import(
      "@/features/catalog/server/teacher-page-data"
    );
    const result = await getTeacherPage(teacher.id);

    expect(result).toEqual(teacher);
    expect(result).not.toHaveProperty("commentCount");
    expect(result).not.toHaveProperty("latestComments");
  });
});
