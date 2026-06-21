import { afterEach, describe, expect, it, vi } from "vitest";

const {
  buildCourseListWhereMock,
  buildTeacherWhereMock,
  findCourseDetailByJwIdMock,
  findSectionCodeMatchesMock,
  findSectionDetailByJwIdMock,
  findTeacherDetailByIdMock,
  getPrismaMock,
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
    getPrismaMock: vi.fn(() => ({
      teacher: {
        findUnique: teacherFindUniqueMock,
      },
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

describe("academic REST locale adapters", () => {
  afterEach(() => {
    vi.clearAllMocks();
    clearPublicRuntimeCache();
  });

  it("passes request locale to course detail reads", async () => {
    const { getCourseDetailRoute } = await import(
      "@/lib/api/routes/academic-course-routes"
    );

    await getCourseDetailRoute(request("/api/courses/123"), { jwId: "123" });

    expect(findCourseDetailByJwIdMock).toHaveBeenCalledWith(123, "en-us");
  });

  it("passes request locale to section detail reads", async () => {
    const { getSectionDetailRoute } = await import(
      "@/lib/api/routes/academic-section-routes"
    );

    await getSectionDetailRoute(request("/api/sections/123"), {
      jwId: "123",
    });

    expect(findSectionDetailByJwIdMock).toHaveBeenCalledWith(123, "en-us");
  });

  it("passes request locale to teacher detail reads", async () => {
    const { getTeacherDetailRoute } = await import(
      "@/lib/api/routes/academic-teacher-routes"
    );

    await getTeacherDetailRoute(request("/api/teachers/456"), { id: "456" });

    expect(findTeacherDetailByIdMock).toHaveBeenCalledWith(456, "en-us");
  });

  it("passes request locale to section-code matching", async () => {
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

  it("uses locale-aware shared section summaries for section lists", async () => {
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

  it("passes request locale to course and teacher list reads", async () => {
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
});
