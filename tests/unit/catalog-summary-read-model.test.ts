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

describe("catalog summary read models", () => {
  beforeEach(() => {
    buildCourseListWhereMock.mockReset();
    buildSectionListQueryMock.mockReset();
    paginatedCourseQueryMock.mockReset();
    paginatedSectionSummaryQueryMock.mockReset();
  });

  it("applies the shared course summary default order", async () => {
    buildCourseListWhereMock.mockReturnValueOnce({ search: "math" });
    const { COURSE_SUMMARY_DEFAULT_ORDER_BY, listCourseSummaries } =
      await import("@/features/catalog/server/course-summary-read-model");

    listCourseSummaries({
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

  it("applies the shared section summary default order when filters do not provide one", async () => {
    buildSectionListQueryMock.mockReturnValueOnce({
      where: { semesterId: 1 },
      orderBy: undefined,
    });
    const { SECTION_SUMMARY_DEFAULT_ORDER_BY, listSectionSummaries } =
      await import("@/features/catalog/server/section-summary-read-model");

    listSectionSummaries({
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

  it("keeps explicit section ordering from filters", async () => {
    const explicitOrder = { jwId: "asc" };
    buildSectionListQueryMock.mockReturnValueOnce({
      where: { search: "001" },
      orderBy: explicitOrder,
    });
    const { listSectionSummaries } = await import(
      "@/features/catalog/server/section-summary-read-model"
    );

    listSectionSummaries({
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
});
