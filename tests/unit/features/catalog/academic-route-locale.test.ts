import { afterEach, describe, expect, it, vi } from "vitest";

const PUBLIC_CATALOG_CDN_CACHE =
  "public, max-age=86400, stale-while-revalidate=300";

vi.mock("@/lib/catalog-detail-cache-revision", () => ({
  getCatalogDetailCacheRevision: vi.fn().mockResolvedValue("test-revision"),
}));

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
  const pagination = { page: 1, pageSize: 20, total: 0, totalPages: 0 };
  const course = {
    id: 1,
    jwId: 123,
    code: "TEST1001",
    nameCn: "测试课程",
    nameEn: null,
    namePrimary: "测试课程",
    nameSecondary: null,
    categoryId: null,
    classTypeId: null,
    classifyId: null,
    educationLevelId: null,
    gradationId: null,
    typeId: null,
    category: null,
    classType: null,
    classify: null,
    educationLevel: null,
    gradation: null,
    type: null,
  };
  const teacher = {
    id: 456,
    jwId: 456,
    personId: null,
    code: null,
    nameCn: "测试教师",
    nameEn: null,
    namePrimary: "测试教师",
    nameSecondary: null,
    email: null,
    telephone: null,
    mobile: null,
    address: null,
    departmentId: null,
    teacherTitleId: null,
    department: null,
    teacherTitle: null,
  };
  const section = {
    id: 2,
    jwId: 123,
    retiredAt: null,
    code: "TEST1001.01",
    bizTypeId: null,
    credits: null,
    period: null,
    periodsPerWeek: null,
    timesPerWeek: null,
    stdCount: null,
    limitCount: null,
    graduateAndPostgraduate: null,
    dateTimePlaceText: null,
    dateTimePlacePersonText: null,
    actualPeriods: null,
    theoryPeriods: null,
    practicePeriods: null,
    experimentPeriods: null,
    machinePeriods: null,
    designPeriods: null,
    testPeriods: null,
    scheduleState: null,
    suggestScheduleWeeks: null,
    suggestScheduleWeekInfo: null,
    scheduleJsonParams: null,
    selectedStdCount: null,
    remark: null,
    scheduleRemark: null,
    courseId: 1,
    semesterId: null,
    campusId: null,
    examModeId: null,
    openDepartmentId: null,
    teachLanguageId: null,
    roomTypeId: null,
    course,
    semester: null,
    campus: null,
    openDepartment: null,
    examMode: null,
    teachLanguage: null,
    roomType: null,
    schedules: [],
    scheduleGroups: [],
    teachers: [],
    teacherAssignments: [],
    exams: [],
    adminClasses: [],
  };
  return {
    buildCourseListWhereMock: vi.fn(() => ({ courseWhere: true })),
    buildTeacherWhereMock: vi.fn(() => ({ teacherWhere: true })),
    findCourseDetailByJwIdMock: vi.fn(async () => ({
      ...course,
      sections: [],
      _count: { sections: 0 },
    })),
    findSectionCodeMatchesMock: vi.fn(async () => ({
      matchedCodes: ["MATH101"],
      sections: [],
      semester: { code: "2026SPRING", id: 1, nameCn: "2026 Spring" },
      suggestions: {},
      total: 0,
      unmatchedCodes: [],
    })),
    findSectionDetailByJwIdMock: vi.fn(async () => section),
    findTeacherDetailByIdMock: vi.fn(async () => ({
      ...teacher,
      sections: [],
      _count: { sections: 0 },
    })),
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
      pagination,
    })),
    listCourseSummariesMock: vi.fn(async () => ({
      data: [],
      pagination,
    })),
    listTeacherSummariesMock: vi.fn(async () => ({
      data: [],
      pagination,
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

  it("将显式语言传递给课程详情读取", async () => {
    const { getCourseDetailRoute } = await import(
      "@/lib/api/routes/academic-course-routes"
    );

    const response = await getCourseDetailRoute(
      request("/api/catalog/courses/123?locale=en-us"),
      {
        jwId: "123",
      },
    );

    expect(findCourseDetailByJwIdMock).toHaveBeenCalledWith(123, "en-us");
    expect(response.headers.get("Vary")).toBeNull();
  });

  it("将显式语言传递给班级详情读取", async () => {
    const { getSectionDetailRoute } = await import(
      "@/lib/api/routes/academic-section-routes"
    );

    const response = await getSectionDetailRoute(
      request("/api/catalog/sections/123?locale=en-us"),
      {
        jwId: "123",
      },
    );

    expect(findSectionDetailByJwIdMock).toHaveBeenCalledWith(123, "en-us", {
      includeExams: undefined,
      includeSchedules: undefined,
      includeTeacherDepartments: undefined,
    });
    expect(response.headers.get("Vary")).toBeNull();
  });

  it("将部分查询标志传递给班级详情读取", async () => {
    const { getSectionDetailRoute } = await import(
      "@/lib/api/routes/academic-section-routes"
    );

    await getSectionDetailRoute(
      request(
        "/api/catalog/sections/123?includeExams=true&includeSchedules=true&locale=en-us",
      ),
      {
        jwId: "123",
      },
    );

    expect(findSectionDetailByJwIdMock).toHaveBeenCalledWith(123, "en-us", {
      includeExams: true,
      includeSchedules: true,
      includeTeacherDepartments: undefined,
    });
  });

  it("将显式语言传递给教师详情读取", async () => {
    const { getTeacherDetailRoute } = await import(
      "@/lib/api/routes/academic-teacher-routes"
    );

    const response = await getTeacherDetailRoute(
      request("/api/catalog/teachers/456?locale=en-us"),
      {
        id: "456",
      },
    );

    expect(findTeacherDetailByIdMock).toHaveBeenCalledWith(456, "en-us");
    expect(response.headers.get("Vary")).toBeNull();
  });

  it("将请求语言传递给班级代码匹配", async () => {
    const { postSectionMatchCodesRoute } = await import(
      "@/lib/api/routes/academic-section-routes"
    );

    await postSectionMatchCodesRoute(
      request("/api/catalog/sections/match-codes", {
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

  it("班级列表使用显式语言的共享班级摘要", async () => {
    const { getSectionsRoute } = await import(
      "@/lib/api/routes/academic-section-routes"
    );

    const response = await getSectionsRoute(
      request("/api/catalog/sections?search=math&page=1&locale=en-us"),
    );

    expect(listSectionSummariesMock).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en-us" }),
    );
    expect(response.headers.get("Vary")).toBeNull();
  });

  it("将显式语言传递给课程与教师列表读取", async () => {
    const [{ getCoursesRoute }, { getTeachersRoute }] = await Promise.all([
      import("@/lib/api/routes/academic-course-routes"),
      import("@/lib/api/routes/academic-teacher-routes"),
    ]);

    await getCoursesRoute(
      request("/api/catalog/courses?search=math&page=1&locale=en-us"),
    );
    await getTeachersRoute(
      request("/api/catalog/teachers?search=li&page=1&locale=en-us"),
    );

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

  it("将显式语言传递给公共课表读取", async () => {
    const { getSchedulesRoute } = await import(
      "@/lib/api/routes/academic-schedule-routes"
    );

    const response = await getSchedulesRoute(
      request(
        "/api/catalog/schedules?sectionJwId=123&weekday=2&dateFrom=2026-03-01&page=1&locale=en-us",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });
    expect(response.headers.get("Vary")).toBeNull();
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

  it("将显式语言传递给班级课表读取", async () => {
    const { getSectionSchedulesRoute, getSectionScheduleGroupsRoute } =
      await import("@/lib/api/routes/academic-section-routes");

    const schedulesResponse = await getSectionSchedulesRoute(
      request(
        "/api/catalog/sections/123/schedules?dateFrom=2026-03-01&limit=25&locale=en-us",
      ),
      { jwId: "123" },
    );
    const scheduleGroupsResponse = await getSectionScheduleGroupsRoute(
      request("/api/catalog/sections/123/schedule-groups?locale=en-us"),
      { jwId: "123" },
    );

    expect(schedulesResponse.status).toBe(200);
    await expect(schedulesResponse.json()).resolves.toEqual([]);
    expect(schedulesResponse.headers.get("Vary")).toBeNull();
    expect(scheduleGroupsResponse.status).toBe(200);
    await expect(scheduleGroupsResponse.json()).resolves.toEqual([]);
    expect(scheduleGroupsResponse.headers.get("Vary")).toBeNull();
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

  it("对默认和显式语言都返回公共缓存策略", async () => {
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
      await getCoursesRoute(request("/api/catalog/courses")),
      await getCoursesRoute(request("/api/catalog/courses?locale=zh-cn")),
      await getCourseDetailRoute(
        request("/api/catalog/courses/123?locale=zh-cn"),
        {
          jwId: "123",
        },
      ),
      await getTeachersRoute(request("/api/catalog/teachers?locale=zh-cn")),
      await getTeacherDetailRoute(
        request("/api/catalog/teachers/456?locale=zh-cn"),
        {
          id: "456",
        },
      ),
      await getSectionsRoute(request("/api/catalog/sections?locale=zh-cn")),
      await getSectionDetailRoute(
        request("/api/catalog/sections/123?locale=zh-cn"),
        {
          jwId: "123",
        },
      ),
      await getSchedulesRoute(request("/api/catalog/schedules?locale=zh-cn")),
      await getSectionSchedulesRoute(
        request("/api/catalog/sections/123/schedules?locale=zh-cn"),
        { jwId: "123" },
      ),
      await getSectionScheduleGroupsRoute(
        request("/api/catalog/sections/123/schedule-groups?locale=zh-cn"),
        { jwId: "123" },
      ),
    ];

    for (const response of responses) {
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=0, stale-while-revalidate=300",
      );
      expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
        PUBLIC_CATALOG_CDN_CACHE,
      );
    }

    expect(findCourseDetailByJwIdMock).toHaveBeenCalledWith(123, "zh-cn");
    expect(findTeacherDetailByIdMock).toHaveBeenCalledWith(456, "zh-cn");
    expect(findSectionDetailByJwIdMock).toHaveBeenCalledWith(123, "zh-cn", {
      includeExams: undefined,
      includeSchedules: undefined,
      includeTeacherDepartments: undefined,
    });
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
      request("/api/catalog/courses/123?locale=fr-fr"),
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
