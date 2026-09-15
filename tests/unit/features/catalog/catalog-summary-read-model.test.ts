import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildCourseListWhereMock,
  buildSectionListQueryMock,
  paginatedCourseQueryMock,
  paginatedSectionSummaryQueryMock,
} = vi.hoisted(() => ({
  buildCourseListWhereMock: vi.fn(),
  buildSectionListQueryMock: vi.fn(),
  paginatedCourseQueryMock: vi.fn(),
  paginatedSectionSummaryQueryMock: vi.fn(),
}));

vi.mock("@/features/catalog/server/academic-paginated-queries", () => ({
  paginatedCourseQuery: paginatedCourseQueryMock,
  paginatedSectionSummaryQuery: paginatedSectionSummaryQueryMock,
}));

vi.mock("@/features/catalog/server/course-section-query-filters", () => ({
  buildCourseListWhere: buildCourseListWhereMock,
  buildSectionListQuery: buildSectionListQueryMock,
}));

vi.mock("@/features/catalog/server/catalog-list-cache", () => ({
  cachedCatalogListRead: ({ load }: { load: () => Promise<unknown> }) => load(),
}));

vi.mock("@/features/catalog/server/catalog-list-cache", () => ({
  cachedCatalogListRead: ({ load }: { load: () => Promise<unknown> }) => load(),
}));

describe("课程目录摘要读取模型", () => {
  beforeEach(() => {
    buildCourseListWhereMock.mockReset();
    buildSectionListQueryMock.mockReset();
    paginatedCourseQueryMock.mockReset();
    paginatedSectionSummaryQueryMock.mockReset();
  });

  it("应用共享的课程摘要默认排序", async () => {
    buildCourseListWhereMock.mockReturnValueOnce({ search: "math" });
    const { COURSE_SUMMARY_DEFAULT_ORDER_BY, listCourseSummaries } =
      await import("@/features/catalog/server/course-summary-read-model");

    await listCourseSummaries({
      filters: { search: "math" },
      locale: "en-us",
      pagination: { page: 2, pageSize: 10 },
    });

    expect(paginatedCourseQueryMock).toHaveBeenCalledWith(
      2,
      10,
      { search: "math" },
      COURSE_SUMMARY_DEFAULT_ORDER_BY,
      "en-us",
    );
  });

  it("筛选条件未提供排序时使用共享的课段摘要默认排序", async () => {
    buildSectionListQueryMock.mockReturnValueOnce({
      where: { semesterId: 1 },
      orderBy: undefined,
    });
    const { SECTION_SUMMARY_DEFAULT_ORDER_BY, listSectionSummaries } =
      await import("@/features/catalog/server/section-summary-read-model");

    await listSectionSummaries({
      filters: { semesterId: 1 },
      locale: "zh-cn",
      pagination: { page: 1, pageSize: 20 },
    });

    expect(paginatedSectionSummaryQueryMock).toHaveBeenCalledWith(
      1,
      20,
      { semesterId: 1 },
      SECTION_SUMMARY_DEFAULT_ORDER_BY,
      "zh-cn",
    );
  });

  it("保留筛选条件中的显式课段排序", async () => {
    const explicitOrder = { jwId: "asc" };
    buildSectionListQueryMock.mockReturnValueOnce({
      where: { search: "001" },
      orderBy: explicitOrder,
    });
    const { listSectionSummaries } = await import(
      "@/features/catalog/server/section-summary-read-model"
    );

    await listSectionSummaries({
      filters: { search: "001" },
      locale: "en-us",
      pagination: { page: 3, pageSize: 5 },
    });

    expect(paginatedSectionSummaryQueryMock).toHaveBeenCalledWith(
      3,
      5,
      { search: "001" },
      explicitOrder,
      "en-us",
    );
  });

  it("将课程 jwId 关系筛选直接交给单次课段查询", async () => {
    buildSectionListQueryMock.mockReturnValueOnce({
      where: { course: { jwId: 19_901_001 } },
      orderBy: undefined,
    });
    const { listSectionSummaries } = await import(
      "@/features/catalog/server/section-summary-read-model"
    );

    await listSectionSummaries({
      filters: { courseJwId: 19_901_001 },
      locale: "zh-cn",
      pagination: { page: 1, pageSize: 20 },
    });

    expect(buildSectionListQueryMock).toHaveBeenCalledWith({
      courseJwId: 19_901_001,
    });
    expect(paginatedSectionSummaryQueryMock).toHaveBeenCalledWith(
      1,
      20,
      { course: { jwId: 19_901_001 } },
      expect.anything(),
      "zh-cn",
    );
  });
});
