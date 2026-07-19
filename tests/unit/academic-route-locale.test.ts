import { afterEach, describe, expect, it, vi } from "vitest";

const {
  buildCourseListWhereMock,
  buildTeacherWhereMock,
  findCourseDetailByJwIdMock,
  findSectionCodeMatchesMock,
  findSectionDetailByJwIdMock,
  findTeacherDetailByIdMock,
  getSectionScheduleGroupsByJwIdMock,
  getSectionSchedulesByJwIdMock,
  getPrismaMock,
  listPublicSchedulesMock,
  listCourseSummariesMock,
  listSectionSummariesMock,
  listTeacherSummariesMock,
  paginatedCourseQueryMock,
  paginatedTeacherQueryMock,
  parseJwIdRouteParamMock,
  parseResourceIdRouteParamMock,
} = vi.hoisted(() => {
  const teacherFindUniqueMock = vi.fn(async () => ({ id: 456 }));
  return {
    buildCourseListWhereMock: vi.fn(() => ({ courseWhere: true })),
    buildTeacherWhereMock: vi.fn(() => ({ teacherWhere: true })),
    findCourseDetailByJwIdMock: vi.fn(async () => ({ id: 1 })),
    findSectionCodeMatchesMock: vi.fn(async () => ({
      matchedCodes: ["MATH101"],
      sections: [],
      semester: { code: "2026SPRING", id: 1, nameCn: "2026 Spring" },
      suggestions: {},
      total: 0,
      unmatchedCodes: [],
    })),
    findSectionDetailByJwIdMock: vi.fn(async () => ({ id: 2 })),
    findTeacherDetailByIdMock: vi.fn(async () => ({ id: 456 })),
    getSectionScheduleGroupsByJwIdMock: vi.fn(async () => ({
      found: true,
      scheduleGroups: [],
    })),
    getSectionSchedulesByJwIdMock: vi.fn(async () => ({
      found: true,
      schedules: [],
    })),
    getPrismaMock: vi.fn(() => ({
      teacher: {
        findUnique: teacherFindUniqueMock,
      },
    })),
    listPublicSchedulesMock: vi.fn(async () => ({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    })),
    listSectionSummariesMock: vi.fn(async () => ({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    })),
    listCourseSummariesMock: vi.fn(async () => ({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    })),
    listTeacherSummariesMock: vi.fn(async () => ({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    })),
    paginatedCourseQueryMock: vi.fn(async () => ({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    })),
    paginatedTeacherQueryMock: vi.fn(async () => ({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    })),
    parseJwIdRouteParamMock: vi.fn(() => 123),
    parseResourceIdRouteParamMock: vi.fn(() => 456),
    teacherFindUniqueMock,
  };
});

vi.mock("@/lib/api/routes/academic-route-helpers", () => ({
  parseJwIdRouteParam: parseJwIdRouteParamMock,
  parseResourceIdRouteParam: parseResourceIdRouteParamMock,
}));

vi.mock("@/features/catalog/server/course-section-queries", () => ({
  buildCourseListWhere: buildCourseListWhereMock,
  findCourseDetailByJwId: findCourseDetailByJwIdMock,
  findSectionCodeMatches: findSectionCodeMatchesMock,
  findSectionDetailByJwId: findSectionDetailByJwIdMock,
  findTeacherDetailById: findTeacherDetailByIdMock,
  listCourseSummaries: listCourseSummariesMock,
  listSectionSummaries: listSectionSummariesMock,
  listTeacherSummaries: listTeacherSummariesMock,
}));

vi.mock("@/features/catalog/server/teacher-query", () => ({
  buildTeacherWhere: buildTeacherWhereMock,
}));

vi.mock("@/features/catalog/server/academic-paginated-queries", () => ({
  paginatedCourseQuery: paginatedCourseQueryMock,
  paginatedTeacherQuery: paginatedTeacherQueryMock,
}));

vi.mock("@/features/catalog/server/schedule-read-model", () => ({
  getSectionScheduleGroupsByJwId: getSectionScheduleGroupsByJwIdMock,
  getSectionSchedulesByJwId: getSectionSchedulesByJwIdMock,
  listPublicSchedules: listPublicSchedulesMock,
}));

vi.mock("@/features/catalog/server/academic-query-includes", () => ({
  teacherDetailInclude: { courses: true },
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: getPrismaMock,
}));

function request(path: string, init?: RequestInit) {
  return new Request(`https://example.test${path}`, {
    ...init,
    headers: {
      "accept-language": "en-US,en;q=0.9",
      ...init?.headers,
    },
  });
}

function clearPublicRuntimeCache() {
  delete (
    globalThis as typeof globalThis & {
      __lifeUstcPublicRuntimeCache?: unknown;
    }
  ).__lifeUstcPublicRuntimeCache;
}

describe("academic REST 语言适配器", () => {
  afterEach(() => {
    vi.clearAllMocks();
    clearPublicRuntimeCache();
  });

  it("将请求语言传递给课程详情读取", async () => {
    const { getCourseDetailRoute } = await import(
      "@/lib/api/routes/academic-course-routes"
    );

    const response = await getCourseDetailRoute(request("/api/courses/123"), {
      jwId: "123",
    });

    expect(findCourseDetailByJwIdMock).toHaveBeenCalledWith(123, "en-us");
    expect(response.headers.get("Vary")).toBe("Accept-Language, Cookie");
  });

  it("将请求语言传递给班级详情读取", async () => {
    const { getSectionDetailRoute } = await import(
      "@/lib/api/routes/academic-section-routes"
    );

    const response = await getSectionDetailRoute(request("/api/sections/123"), {
      jwId: "123",
    });

    expect(findSectionDetailByJwIdMock).toHaveBeenCalledWith(123, "en-us");
    expect(response.headers.get("Vary")).toBe("Accept-Language, Cookie");
  });

  it("将请求语言传递给教师详情读取", async () => {
    const { getTeacherDetailRoute } = await import(
      "@/lib/api/routes/academic-teacher-routes"
    );

    const response = await getTeacherDetailRoute(request("/api/teachers/456"), {
      id: "456",
    });

    expect(findTeacherDetailByIdMock).toHaveBeenCalledWith(456, "en-us");
    expect(response.headers.get("Vary")).toBe("Accept-Language, Cookie");
  });

  it("将请求语言传递给班级代码匹配", async () => {
    const { postSectionMatchCodesRoute } = await import(
      "@/lib/api/routes/academic-section-routes"
    );

    await postSectionMatchCodesRoute(
      request("/api/sections/match-codes", {
        body: JSON.stringify({ codes: ["MATH101"] }),
        method: "POST",
      }),
    );

    expect(findSectionCodeMatchesMock).toHaveBeenCalledWith(
      ["MATH101"],
      "en-us",
      undefined,
    );
  });

  it("班级列表使用支持语言的共享班级摘要", async () => {
    const { getSectionsRoute } = await import(
      "@/lib/api/routes/academic-section-routes"
    );

    const response = await getSectionsRoute(
      request("/api/sections?search=math&page=1"),
    );

    expect(listSectionSummariesMock).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en-us" }),
    );
    expect(response.headers.get("Vary")).toBe("Accept-Language, Cookie");
  });

  it("将请求语言传递给课程与教师列表读取", async () => {
    const [{ getCoursesRoute }, { getTeachersRoute }] = await Promise.all([
      import("@/lib/api/routes/academic-course-routes"),
      import("@/lib/api/routes/academic-teacher-routes"),
    ]);

    await getCoursesRoute(request("/api/courses?search=math&page=1"));
    await getTeachersRoute(request("/api/teachers?search=li&page=1"));

    expect(listCourseSummariesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ search: "math" }),
        locale: "en-us",
        pagination: expect.objectContaining({ page: 1, pageSize: 20 }),
      }),
    );
    expect(listTeacherSummariesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ search: "li" }),
        locale: "en-us",
        pagination: expect.objectContaining({ page: 1, pageSize: 20 }),
      }),
    );
  });

  it("将请求语言传递给公共课表读取", async () => {
    const { getSchedulesRoute } = await import(
      "@/lib/api/routes/academic-schedule-routes"
    );

    const response = await getSchedulesRoute(
      request(
        "/api/schedules?sectionJwId=123&weekday=2&dateFrom=2026-03-01&page=1",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });
    expect(response.headers.get("Vary")).toBe("Accept-Language, Cookie");
    expect(listPublicSchedulesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          sectionJwId: 123,
          weekday: 2,
          dateFrom: new Date("2026-03-01T00:00:00.000Z"),
        }),
        locale: "en-us",
        page: 1,
        pageSize: 20,
      }),
    );
  });

  it("将请求语言传递给班级课表读取", async () => {
    const { getSectionSchedulesRoute, getSectionScheduleGroupsRoute } =
      await import("@/lib/api/routes/academic-section-routes");

    const schedulesResponse = await getSectionSchedulesRoute(
      request("/api/sections/123/schedules?dateFrom=2026-03-01&limit=25"),
      { jwId: "123" },
    );
    const scheduleGroupsResponse = await getSectionScheduleGroupsRoute(
      request("/api/sections/123/schedule-groups"),
      { jwId: "123" },
    );

    expect(schedulesResponse.status).toBe(200);
    await expect(schedulesResponse.json()).resolves.toEqual([]);
    expect(schedulesResponse.headers.get("Vary")).toBe(
      "Accept-Language, Cookie",
    );
    expect(scheduleGroupsResponse.status).toBe(200);
    await expect(scheduleGroupsResponse.json()).resolves.toEqual([]);
    expect(scheduleGroupsResponse.headers.get("Vary")).toBe(
      "Accept-Language, Cookie",
    );
    expect(getSectionSchedulesByJwIdMock).toHaveBeenCalledWith({
      dateFrom: new Date("2026-03-01T00:00:00.000Z"),
      dateTo: undefined,
      limit: 25,
      locale: "en-us",
      sectionJwId: 123,
    });
    expect(getSectionScheduleGroupsByJwIdMock).toHaveBeenCalledWith({
      locale: "en-us",
      sectionJwId: 123,
    });
  });

  it("仅对 URL 中显式支持的语言返回公共缓存策略", async () => {
    const [
      { getCourseDetailRoute, getCoursesRoute },
      { getSchedulesRoute },
      {
        getSectionDetailRoute,
        getSectionScheduleGroupsRoute,
        getSectionSchedulesRoute,
        getSectionsRoute,
      },
      { getTeacherDetailRoute, getTeachersRoute },
    ] = await Promise.all([
      import("@/lib/api/routes/academic-course-routes"),
      import("@/lib/api/routes/academic-schedule-routes"),
      import("@/lib/api/routes/academic-section-routes"),
      import("@/lib/api/routes/academic-teacher-routes"),
    ]);

    const responses = [
      await getCoursesRoute(request("/api/courses?locale=zh-cn")),
      await getCourseDetailRoute(request("/api/courses/123?locale=zh-cn"), {
        jwId: "123",
      }),
      await getTeachersRoute(request("/api/teachers?locale=zh-cn")),
      await getTeacherDetailRoute(request("/api/teachers/456?locale=zh-cn"), {
        id: "456",
      }),
      await getSectionsRoute(request("/api/sections?locale=zh-cn")),
      await getSectionDetailRoute(request("/api/sections/123?locale=zh-cn"), {
        jwId: "123",
      }),
      await getSchedulesRoute(request("/api/schedules?locale=zh-cn")),
      await getSectionSchedulesRoute(
        request("/api/sections/123/schedules?locale=zh-cn"),
        { jwId: "123" },
      ),
      await getSectionScheduleGroupsRoute(
        request("/api/sections/123/schedule-groups?locale=zh-cn"),
        { jwId: "123" },
      ),
    ];

    for (const response of responses) {
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=0, must-revalidate",
      );
      expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
        "public, max-age=60, stale-while-revalidate=300",
      );
    }

    expect(findCourseDetailByJwIdMock).toHaveBeenCalledWith(123, "zh-cn");
    expect(findTeacherDetailByIdMock).toHaveBeenCalledWith(456, "zh-cn");
    expect(findSectionDetailByJwIdMock).toHaveBeenCalledWith(123, "zh-cn");
    expect(listPublicSchedulesMock).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "zh-cn" }),
    );
    expect(getSectionSchedulesByJwIdMock).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "zh-cn" }),
    );
    expect(getSectionScheduleGroupsByJwIdMock).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "zh-cn" }),
    );
  });

  it("在进入目录读取前拒绝无效的显式语言", async () => {
    const { getCourseDetailRoute } = await import(
      "@/lib/api/routes/academic-course-routes"
    );

    const response = await getCourseDetailRoute(
      request("/api/courses/123?locale=fr-fr"),
      { jwId: "123" },
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "no-store",
    );
    expect(findCourseDetailByJwIdMock).not.toHaveBeenCalled();
  });
});
