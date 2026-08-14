import { afterEach, describe, expect, it, vi } from "vitest";

const PUBLIC_CATALOG_CDN_CACHE =
  "public, max-age=86400, stale-while-revalidate=300";

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

describe("academic 列表路由公共缓存策略", () => {
  afterEach(() => {
    listCourseSummariesMock.mockClear();
    listTeacherSummariesMock.mockClear();
    vi.resetModules();
  });

  it("课程列表返回确定性的公共缓存策略", async () => {
    const { getCoursesRoute } = await import(
      "@/lib/api/routes/academic-course-routes"
    );

    const first = await getCoursesRoute(
      new Request(
        "https://example.test/api/catalog/courses?locale=en-us&search=math&page=1",
      ),
    );
    const second = await getCoursesRoute(
      new Request(
        "https://example.test/api/catalog/courses?page=1&search=math&locale=en-us",
      ),
    );

    expect(first.headers.get("Cache-Control")).toBe(
      "public, max-age=0, stale-while-revalidate=300",
    );
    expect(first.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      PUBLIC_CATALOG_CDN_CACHE,
    );
    expect(first.headers.get("Vary")).toBeNull();
    expect(second.status).toBe(200);
    expect(listCourseSummariesMock).toHaveBeenCalledTimes(2);
  });

  it("教师列表返回确定性的公共缓存策略", async () => {
    const { getTeachersRoute } = await import(
      "@/lib/api/routes/academic-teacher-routes"
    );

    const first = await getTeachersRoute(
      new Request(
        "https://example.test/api/catalog/teachers?locale=zh-cn&search=li&page=1",
      ),
    );
    const second = await getTeachersRoute(
      new Request(
        "https://example.test/api/catalog/teachers?page=1&search=li&locale=zh-cn",
      ),
    );

    expect(first.headers.get("Cache-Control")).toBe(
      "public, max-age=0, stale-while-revalidate=300",
    );
    expect(first.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      PUBLIC_CATALOG_CDN_CACHE,
    );
    expect(first.headers.get("Vary")).toBeNull();
    expect(second.status).toBe(200);
    expect(listTeacherSummariesMock).toHaveBeenCalledTimes(2);
  });

  it("defaults to public zh-cn instead of negotiating request headers", async () => {
    const { getCoursesRoute } = await import(
      "@/lib/api/routes/academic-course-routes"
    );

    const response = await getCoursesRoute(
      new Request("https://example.test/api/catalog/courses?page=1", {
        headers: { "accept-language": "en-US" },
      }),
    );

    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=0, stale-while-revalidate=300",
    );
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      PUBLIC_CATALOG_CDN_CACHE,
    );
    expect(response.headers.get("Vary")).toBeNull();
    expect(listCourseSummariesMock).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "zh-cn" }),
    );
  });
});
