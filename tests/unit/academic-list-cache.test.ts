import { afterEach, describe, expect, it, vi } from "vitest";

const { listCourseSummariesMock, listTeacherSummariesMock } = vi.hoisted(
  () => ({
    listCourseSummariesMock: vi.fn(async () => ({
      data: [{ id: 1 }],
      meta: { total: 1 },
    })),
    listTeacherSummariesMock: vi.fn(async () => ({
      data: [{ id: 2 }],
      meta: { total: 1 },
    })),
  }),
);

vi.mock("@/lib/api/routes/academic-route-helpers", () => ({
  parseJwIdRouteParam: vi.fn(),
  parseResourceIdRouteParam: vi.fn(),
}));

vi.mock("@/features/catalog/server/course-section-queries", () => ({
  listCourseSummaries: listCourseSummariesMock,
  listTeacherSummaries: listTeacherSummariesMock,
}));

function clearPublicRuntimeCache() {
  delete (
    globalThis as typeof globalThis & {
      __lifeUstcPublicRuntimeCache?: unknown;
    }
  ).__lifeUstcPublicRuntimeCache;
}

describe("academic 列表路由缓存", () => {
  afterEach(() => {
    listCourseSummariesMock.mockClear();
    listTeacherSummariesMock.mockClear();
    clearPublicRuntimeCache();
    vi.resetModules();
  });

  it("对等价查询字符串缓存课程列表响应", async () => {
    const { getCoursesRoute } = await import(
      "@/lib/api/routes/academic-course-routes"
    );

    const first = await getCoursesRoute(
      new Request("https://example.test/api/courses?search=math&page=1"),
    );
    const second = await getCoursesRoute(
      new Request("https://example.test/api/courses?page=1&search=math"),
    );

    expect(first.headers.get("Cache-Control")).toBe(
      "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    );
    expect(first.headers.get("Vary")).toBe("Accept-Language, Cookie");
    expect(second.status).toBe(200);
    expect(listCourseSummariesMock).toHaveBeenCalledTimes(1);
  });

  it("对等价查询字符串缓存教师列表响应", async () => {
    const { getTeachersRoute } = await import(
      "@/lib/api/routes/academic-teacher-routes"
    );

    const first = await getTeachersRoute(
      new Request("https://example.test/api/teachers?search=li&page=1"),
    );
    const second = await getTeachersRoute(
      new Request("https://example.test/api/teachers?page=1&search=li"),
    );

    expect(first.headers.get("Cache-Control")).toBe(
      "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    );
    expect(first.headers.get("Vary")).toBe("Accept-Language, Cookie");
    expect(second.status).toBe(200);
    expect(listTeacherSummariesMock).toHaveBeenCalledTimes(1);
  });
});
