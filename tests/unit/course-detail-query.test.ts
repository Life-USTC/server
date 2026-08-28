import { beforeEach, describe, expect, it, vi } from "vitest";

const { courseFindUniqueMock } = vi.hoisted(() => ({
  courseFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/catalog-detail-cache-revision", () => ({
  getCatalogDetailCacheRevision: vi.fn(async () => "test-revision"),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    course: { findUnique: courseFindUniqueMock },
  }),
}));

describe("course detail query", () => {
  beforeEach(() => {
    courseFindUniqueMock.mockReset();
  });

  it("loads REST and MCP course detail directly by the unique jwId", async () => {
    const course = {
      id: 7,
      jwId: 683_001,
      code: "COURSE-7",
      nameCn: "课程 7",
      nameEn: "Course 7",
      categoryId: null,
      classTypeId: null,
      classifyId: null,
      educationLevelId: null,
      gradationId: null,
      typeId: null,
      category: null,
      classType: null,
      classify: null,
      educationLevel: null,
      gradation: null,
      type: null,
      sections: [],
      _count: { sections: 0 },
    };
    courseFindUniqueMock.mockResolvedValue(course);
    const { findCourseDetailByJwId } = await import(
      "@/features/catalog/server/course-section-read-queries"
    );

    await expect(
      findCourseDetailByJwId(course.jwId, "en-us"),
    ).resolves.toMatchObject({
      id: course.id,
      jwId: course.jwId,
      namePrimary: "Course 7",
      nameSecondary: "课程 7",
    });
    expect(courseFindUniqueMock).toHaveBeenCalledTimes(1);
    expect(courseFindUniqueMock).toHaveBeenCalledWith({
      where: { jwId: course.jwId },
      include: expect.any(Object),
    });
  });
});
