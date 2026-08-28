import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";

const { getCatalogDetailCacheRevisionMock, paginatedCourseQueryMock } =
  vi.hoisted(() => ({
    getCatalogDetailCacheRevisionMock: vi.fn(async () => "revision-1"),
    paginatedCourseQueryMock: vi.fn(async () => ({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    })),
  }));

vi.mock("@/features/catalog/server/academic-paginated-queries", () => ({
  paginatedCourseQuery: paginatedCourseQueryMock,
}));

vi.mock("@/lib/catalog-detail-cache-revision", () => ({
  getCatalogDetailCacheRevision: getCatalogDetailCacheRevisionMock,
}));

describe("shared catalog list read cache", () => {
  beforeEach(() => {
    paginatedCourseQueryMock.mockClear();
    getCatalogDetailCacheRevisionMock.mockReset();
    getCatalogDetailCacheRevisionMock.mockResolvedValue("revision-1");
    resetPublicRuntimeCacheForTest();
  });

  it("isolates in-isolate entries by materialization revision", async () => {
    const { listCourseSummaries } = await import(
      "@/features/catalog/server/course-summary-read-model"
    );

    await listCourseSummaries({
      filters: {},
      locale: "zh-cn",
      pagination: { page: 1, pageSize: 20 },
    });
    getCatalogDetailCacheRevisionMock.mockResolvedValue("revision-2");
    await listCourseSummaries({
      filters: {},
      locale: "zh-cn",
      pagination: { page: 1, pageSize: 20 },
    });

    expect(paginatedCourseQueryMock).toHaveBeenCalledTimes(2);
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
