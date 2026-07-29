import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  CATALOG_MAX_PAGE,
  CATALOG_SEARCH_MAX_LENGTH,
  CATALOG_TEXT_FILTER_MAX_LENGTH,
} from "@/features/catalog/lib/catalog-list-query";
import { getCourseListPage } from "@/features/catalog/server/public-course-list-data";
import { getSectionListPage } from "@/features/catalog/server/public-section-list-data";
import { getTeacherListPage } from "@/features/catalog/server/public-teacher-list-data";

const mocks = vi.hoisted(() => {
  const findMany = vi.fn().mockResolvedValue([]);
  return {
    cache: vi.fn(
      (
        _namespace: string,
        _key: string,
        _ttlMs: number,
        load: () => Promise<unknown>,
      ) => load(),
    ),
    findMany,
    listCourseSummaries: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, total: 0, totalPages: 0 },
    }),
    listSectionSummaries: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, total: 0, totalPages: 0 },
    }),
    paginatedTeacherQuery: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, total: 0, totalPages: 0 },
    }),
  };
});

vi.mock("@/lib/public-runtime-cache", () => ({
  cachedPublicRuntimeData: mocks.cache,
  publicRuntimeCacheKey: (prefix: string, params: URLSearchParams) =>
    `${prefix}:${params.toString()}`,
}));

vi.mock("@/features/catalog/server/course-section-queries", () => ({
  listCourseSummaries: mocks.listCourseSummaries,
  listSectionSummaries: mocks.listSectionSummaries,
}));

vi.mock("@/features/catalog/server/academic-paginated-queries", () => ({
  paginatedTeacherQuery: mocks.paginatedTeacherQuery,
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    campus: { findMany: mocks.findMany },
    classType: { findMany: mocks.findMany },
    courseCategory: { findMany: mocks.findMany },
    department: { findMany: mocks.findMany },
    educationLevel: { findMany: mocks.findMany },
    semester: { findMany: mocks.findMany },
  }),
}));

vi.mock("@/i18n/messages.server", () => ({
  getMessages: vi.fn().mockResolvedValue({
    common: {},
    courses: {},
    sectionDetail: { close: "close" },
    sections: {},
    teachers: {},
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("public catalog list loaders", () => {
  test("bounds course page/search and keys the runtime cache by normalized values", async () => {
    const search = "x".repeat(CATALOG_SEARCH_MAX_LENGTH + 20);
    const firstUrl = new URL(
      `https://life-ustc.test/catalog/courses?page=999999&search=%20${search}%20&categoryId=0007&unknown=value`,
    );
    const canonicalUrl = new URL(
      `https://life-ustc.test/catalog/courses?categoryId=7&page=${CATALOG_MAX_PAGE}&search=${"x".repeat(CATALOG_SEARCH_MAX_LENGTH)}`,
    );

    await getCourseListPage(firstUrl);
    await getCourseListPage(canonicalUrl);

    expect(mocks.listCourseSummaries).toHaveBeenNthCalledWith(1, {
      filters: {
        categoryId: "7",
        classTypeId: undefined,
        educationLevelId: undefined,
        search: "x".repeat(CATALOG_SEARCH_MAX_LENGTH),
      },
      locale: "zh-cn",
      pagination: { page: CATALOG_MAX_PAGE, pageSize: 20 },
    });
    expect(mocks.cache.mock.calls[0]?.[0]).toBe("page:course-list:zh-cn");
    expect(mocks.cache.mock.calls[0]?.[1]).toBe(mocks.cache.mock.calls[1]?.[1]);
    expect(mocks.cache.mock.calls[0]?.[1]).toMatch(/^page:course-list:zh-cn:/);
  });

  test("bounds teacher page/search and canonicalizes the ID before querying", async () => {
    const search = "t".repeat(CATALOG_SEARCH_MAX_LENGTH + 1);
    await getTeacherListPage(
      new URL(
        `https://life-ustc.test/catalog/teachers?page=999999&search=${search}&departmentId=0007`,
      ),
    );

    expect(mocks.paginatedTeacherQuery).toHaveBeenCalledWith(
      CATALOG_MAX_PAGE,
      20,
      expect.objectContaining({ departmentId: 7 }),
      { nameCn: "asc" },
      "zh-cn",
    );
    expect(mocks.cache.mock.calls[0]?.[1]).toContain(
      `page=${CATALOG_MAX_PAGE}`,
    );
    expect(mocks.cache.mock.calls[0]?.[1]).toContain(
      `search=${"t".repeat(CATALOG_SEARCH_MAX_LENGTH)}`,
    );
    expect(mocks.cache.mock.calls[0]?.[0]).toBe("page:teacher-list:zh-cn");
    expect(mocks.cache.mock.calls[0]?.[1]).toMatch(/^page:teacher-list:zh-cn:/);
  });

  test("bounds section input and queries from the normalized runtime key", async () => {
    const search = "s".repeat(CATALOG_SEARCH_MAX_LENGTH + 1);
    const teacher = "t".repeat(CATALOG_TEXT_FILTER_MAX_LENGTH + 1);
    await getSectionListPage(
      new URL(
        `https://life-ustc.test/catalog/sections?page=999999&search=${search}&teacher=${teacher}&courseCode=%20MATH%20&semesterId=0003&campusId=2147483648&credits=02.50&sort=CREDITS&order=asc`,
      ),
    );

    expect(mocks.listSectionSummaries).toHaveBeenCalledWith({
      filters: {
        campusId: undefined,
        categoryId: undefined,
        classTypeId: undefined,
        courseCode: "MATH",
        credits: "2.5",
        departmentId: undefined,
        educationLevelId: undefined,
        order: "asc",
        search: "s".repeat(CATALOG_SEARCH_MAX_LENGTH),
        sectionCode: undefined,
        semesterId: "3",
        sort: "credits",
        teacher: "t".repeat(CATALOG_TEXT_FILTER_MAX_LENGTH),
      },
      locale: "zh-cn",
      pagination: { page: CATALOG_MAX_PAGE, pageSize: 20 },
    });
    expect(mocks.cache.mock.calls[0]?.[0]).toBe("page:section-list:zh-cn");
    expect(mocks.cache.mock.calls[0]?.[1]).not.toContain("campusId");
    expect(mocks.cache.mock.calls[0]?.[1]).toContain("courseCode=MATH");
    expect(mocks.cache.mock.calls[0]?.[1]).toContain("credits=2.5");
    expect(mocks.cache.mock.calls[0]?.[1]).toMatch(/^page:section-list:zh-cn:/);
  });
});
