import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCourseListPage } from "@/features/catalog/server/public-course-list-data";
import { getSectionListPage } from "@/features/catalog/server/public-section-list-data";
import { getTeacherListPage } from "@/features/catalog/server/public-teacher-list-data";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";

const mocks = vi.hoisted(() => {
  const options = {
    campus: vi.fn(async () => [{ id: 1, nameCn: "校区" }]),
    classType: vi.fn(async () => [{ id: 2, nameCn: "课程类型" }]),
    courseCategory: vi.fn(async () => [{ id: 3, nameCn: "课程分类" }]),
    department: vi.fn(async () => [{ id: 4, nameCn: "院系" }]),
    educationLevel: vi.fn(async () => [{ id: 5, nameCn: "培养层次" }]),
    semester: vi.fn(async () => [{ id: 6, nameCn: "学期" }]),
  };
  return {
    options,
    revision: vi.fn(async () => "revision-a"),
    list: vi.fn(async () => ({
      data: [],
      pagination: { page: 1, total: 0, totalPages: 0 },
    })),
    getPrisma: vi.fn(() =>
      Object.fromEntries(
        Object.entries(options).map(([name, findMany]) => [name, { findMany }]),
      ),
    ),
  };
});

vi.mock("@/lib/db/prisma", () => ({ getPrisma: mocks.getPrisma }));
vi.mock("@/features/catalog/server/catalog-detail-cache-revision", () => ({
  getCatalogDetailCacheRevision: mocks.revision,
}));
vi.mock("@/features/catalog/server/course-section-queries", () => ({
  listCourseSummaries: mocks.list,
  listSectionSummaries: mocks.list,
}));
vi.mock("@/features/catalog/server/academic-paginated-queries", () => ({
  paginatedTeacherQuery: mocks.list,
}));
vi.mock("@/i18n/messages.server", () => ({
  getMessages: vi.fn(async () => ({
    common: {},
    courses: {},
    sections: {},
    teachers: {},
    sectionDetail: { close: "close" },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.revision.mockResolvedValue("revision-a");
  resetPublicRuntimeCacheForTest();
});

describe("public catalog filter option reuse", () => {
  it.each([
    ["courses", getCourseListPage, 3],
    ["sections", getSectionListPage, 6],
    ["teachers", getTeacherListPage, 1],
  ] as const)(
    "shares %s options across filters and pages without sharing result selections",
    async (kind, load, optionQueries) => {
      const first = await load(
        new URL(`https://life.example/catalog/${kind}?search=数学`),
      );
      const second = await load(
        new URL(`https://life.example/catalog/${kind}?search=物理&page=2`),
      );
      expect(first.filterOptions).toEqual(second.filterOptions);
      expect(first.filters.search).toBe("数学");
      expect(second.filters.search).toBe("物理");
      expect(mocks.list).toHaveBeenCalledTimes(2);
      expect(mocks.getPrisma).toHaveBeenCalledOnce();
      expect(
        Object.values(mocks.options).reduce(
          (count, query) => count + query.mock.calls.length,
          0,
        ),
      ).toBe(optionQueries);
    },
  );

  it("isolates option locale and invalidates them on a committed import revision", async () => {
    const url = new URL("https://life.example/catalog/sections");
    await getSectionListPage(url, "zh-cn");
    await getSectionListPage(url, "en-us");
    expect(mocks.getPrisma.mock.calls).toEqual([["zh-cn"], ["en-us"]]);
    mocks.revision.mockResolvedValue("revision-b");
    await getSectionListPage(url, "zh-cn");
    expect(mocks.options.semester).toHaveBeenCalledTimes(3);
    expect(mocks.list).toHaveBeenCalledTimes(3);
  });

  it("preserves distinct course, active-section and teacher option eligibility", async () => {
    await getCourseListPage(new URL("https://life.example/catalog/courses"));
    await getSectionListPage(new URL("https://life.example/catalog/sections"));
    await getTeacherListPage(new URL("https://life.example/catalog/teachers"));
    expect(mocks.options.courseCategory).toHaveBeenNthCalledWith(1, {
      orderBy: { nameCn: "asc" },
    });
    expect(mocks.options.courseCategory).toHaveBeenNthCalledWith(2, {
      where: { courses: { some: { sections: { some: { retiredAt: null } } } } },
      orderBy: { nameCn: "asc" },
    });
    expect(mocks.options.department).toHaveBeenNthCalledWith(1, {
      where: { sections: { some: { retiredAt: null } } },
      orderBy: { nameCn: "asc" },
    });
    expect(mocks.options.department).toHaveBeenNthCalledWith(2, {
      where: { teachers: { some: {} } },
      select: { id: true, nameCn: true, nameEn: true },
      orderBy: { nameCn: "asc" },
    });
  });
});
