import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cache: new Map<string, unknown>(),
  listCourseSummaries: vi.fn(async () => ({ data: [], pagination: {} })),
  listSectionSummaries: vi.fn(async () => ({ data: [], pagination: {} })),
  listTeacherSummaries: vi.fn(async () => ({ data: [], pagination: {} })),
}));

vi.mock("@/lib/catalog-runtime-cache", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/catalog-runtime-cache")>();
  return {
    ...original,
    cachedCatalogRuntimeData: vi.fn(
      async (
        namespace: string,
        key: string,
        _origin: string,
        load: () => Promise<unknown>,
      ) => {
        const storeKey = `${namespace}:${key}`;
        if (mocks.cache.has(storeKey)) return mocks.cache.get(storeKey);
        const value = await load();
        mocks.cache.set(storeKey, value);
        return value;
      },
    ),
  };
});

vi.mock("@/features/catalog/server/course-section-queries", () => ({
  listCourseSummaries: mocks.listCourseSummaries,
  listSectionSummaries: mocks.listSectionSummaries,
  listTeacherSummaries: mocks.listTeacherSummaries,
}));

import { getCoursesRoute } from "@/lib/api/routes/academic-course-routes";
import { getSectionsRoute } from "@/lib/api/routes/academic-section-routes";
import { getTeachersRoute } from "@/lib/api/routes/academic-teacher-routes";

describe("catalog REST list cache keys", () => {
  beforeEach(() => {
    mocks.cache.clear();
    vi.clearAllMocks();
  });

  it("does not vary course keys for ignored, repeated, or noncanonical raw params", async () => {
    await getCoursesRoute(
      new Request(
        "https://example.test/api/catalog/courses?categoryId=0007&search=math&unknown=one",
      ),
    );
    await getCoursesRoute(
      new Request(
        "https://example.test/api/catalog/courses?categoryId=7&search=math&search=ignored&unknown=two",
      ),
    );

    expect(mocks.listCourseSummaries).toHaveBeenCalledOnce();
    expect(mocks.listCourseSummaries).toHaveBeenCalledWith({
      filters: expect.objectContaining({ categoryId: "7", search: "math" }),
      locale: "zh-cn",
      pagination: expect.objectContaining({ page: 1, pageSize: 20 }),
    });
  });

  it.each([
    {
      first: "/api/catalog/teachers?departmentId=0007&unknown=one",
      second: "/api/catalog/teachers?departmentId=7&departmentId=8&unknown=two",
      loader: mocks.listTeacherSummaries,
      route: getTeachersRoute,
    },
    {
      first: "/api/catalog/sections?courseId=0007&unknown=one",
      second: "/api/catalog/sections?courseId=7&courseId=8&unknown=two",
      loader: mocks.listSectionSummaries,
      route: getSectionsRoute,
    },
  ])("canonicalizes $first before caching", async ({
    first,
    second,
    loader,
    route,
  }) => {
    await route(new Request(`https://example.test${first}`));
    await route(new Request(`https://example.test${second}`));

    expect(loader).toHaveBeenCalledOnce();
  });
});
