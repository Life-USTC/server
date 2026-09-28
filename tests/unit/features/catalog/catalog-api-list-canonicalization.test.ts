import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listCourseSummaries: vi.fn(async () => ({
    data: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
  })),
  listSectionSummaries: vi.fn(async () => ({
    data: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
  })),
  listTeacherSummaries: vi.fn(async () => ({
    data: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
  })),
}));

vi.mock("@/features/catalog/server/course-section-queries", () => ({
  listCourseSummaries: mocks.listCourseSummaries,
  listSectionSummaries: mocks.listSectionSummaries,
  listTeacherSummaries: mocks.listTeacherSummaries,
}));

import { getCoursesRoute } from "@/lib/api/routes/academic-course-routes";
import { getSectionsRoute } from "@/lib/api/routes/academic-section-routes";
import { getTeachersRoute } from "@/lib/api/routes/academic-teacher-routes";

describe("catalog REST list canonicalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("openapi.public-catalog-query-canonicalization", async () => {
    for (const { first, second, loader, route } of [
      {
        first: "/api/catalog/courses?categoryId=0007&search=math&unknown=one",
        second:
          "/api/catalog/courses?unknown=two&search=math&categoryId=7&search=ignored",
        loader: mocks.listCourseSummaries,
        route: getCoursesRoute,
      },
      {
        first: "/api/catalog/teachers?departmentId=0007&unknown=one",
        second:
          "/api/catalog/teachers?unknown=two&departmentId=7&departmentId=8",
        loader: mocks.listTeacherSummaries,
        route: getTeachersRoute,
      },
      {
        first: "/api/catalog/sections?courseId=0007&unknown=one",
        second: "/api/catalog/sections?unknown=two&courseId=7&courseId=8",
        loader: mocks.listSectionSummaries,
        route: getSectionsRoute,
      },
    ]) {
      for (const path of [first, second]) {
        expect(
          (await route(new Request(`https://example.test${path}`))).status,
        ).toBe(200);
      }
      expect(loader).toHaveBeenCalledTimes(2);
      expect(loader.mock.calls[0]).toEqual(loader.mock.calls[1]);
      expect(loader).toHaveBeenCalledWith({
        filters: expect.any(Object),
        locale: "zh-cn",
        pagination: expect.objectContaining({ page: 1, pageSize: 20 }),
      });
    }
    expect(mocks.listCourseSummaries).toHaveBeenCalledWith({
      filters: expect.objectContaining({ categoryId: "7", search: "math" }),
      locale: "zh-cn",
      pagination: expect.objectContaining({ page: 1, pageSize: 20 }),
    });
  });
});
