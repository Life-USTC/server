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
    const course = { id: 7, jwId: 683_001 };
    courseFindUniqueMock.mockResolvedValue(course);
    const { findCourseDetailByJwId } = await import(
      "@/features/catalog/server/course-section-read-queries"
    );

    await expect(findCourseDetailByJwId(course.jwId, "en-us")).resolves.toBe(
      course,
    );
    expect(courseFindUniqueMock).toHaveBeenCalledTimes(1);
    expect(courseFindUniqueMock).toHaveBeenCalledWith({
      where: { jwId: course.jwId },
      include: expect.any(Object),
    });
  });
});
