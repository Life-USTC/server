import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";

const { paginatedCourseQueryMock } = vi.hoisted(() => ({
  paginatedCourseQueryMock: vi.fn(async () => ({
    data: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
  })),
}));

vi.mock("@/features/catalog/server/academic-paginated-queries", () => ({
  paginatedCourseQuery: paginatedCourseQueryMock,
}));

vi.mock("@/lib/catalog-detail-cache-revision", () => ({
  getCatalogDetailCacheRevision: vi.fn(async () => "revision-1"),
}));

describe("shared catalog list read cache", () => {
  beforeEach(() => {
    paginatedCourseQueryMock.mockClear();
    resetPublicRuntimeCacheForTest();
  });

  it("shares one canonical entry across callers", async () => {
    const { listCourseSummaries } = await import(
      "@/features/catalog/server/course-summary-read-model"
    );

    await listCourseSummaries({
      filters: { categoryId: 7, search: "math" },
      locale: "zh-cn",
      pagination: { page: 1, pageSize: 20 },
    });
    await listCourseSummaries({
      filters: { search: "math", categoryId: 7 },
      locale: "zh-cn",
      pagination: { page: 1, pageSize: 20 },
    });

    expect(paginatedCourseQueryMock).toHaveBeenCalledTimes(1);
  });

  it("isolates locale, filters, and pagination", async () => {
    const { listCourseSummaries } = await import(
      "@/features/catalog/server/course-summary-read-model"
    );

    await Promise.all([
      listCourseSummaries({
        filters: { search: "math" },
        locale: "zh-cn",
        pagination: { page: 1, pageSize: 20 },
      }),
      listCourseSummaries({
        filters: { search: "math" },
        locale: "en-us",
        pagination: { page: 1, pageSize: 20 },
      }),
      listCourseSummaries({
        filters: { search: "physics" },
        locale: "zh-cn",
        pagination: { page: 2, pageSize: 20 },
      }),
    ]);

    expect(paginatedCourseQueryMock).toHaveBeenCalledTimes(3);
  });
});
