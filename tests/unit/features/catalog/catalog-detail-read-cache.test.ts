import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { cachedPublicDetailRuntimeData } from "@/lib/catalog-detail-runtime-cache";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";

const {
  courseFindManyMock,
  courseFindUniqueMock,
  getCatalogDetailCacheRevisionMock,
  sectionFindUniqueMock,
  teacherFindManyMock,
  teacherFindUniqueMock,
} = vi.hoisted(() => ({
  courseFindManyMock: vi.fn(),
  courseFindUniqueMock: vi.fn(),
  getCatalogDetailCacheRevisionMock: vi.fn(async () => "revision-a"),
  sectionFindUniqueMock: vi.fn(),
  teacherFindManyMock: vi.fn(),
  teacherFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/catalog-detail-cache-revision", () => ({
  getCatalogDetailCacheRevision: getCatalogDetailCacheRevisionMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({
    course: { findMany: courseFindManyMock, findUnique: courseFindUniqueMock },
    section: { findMany: vi.fn(), findUnique: sectionFindUniqueMock },
    teacher: {
      findMany: teacherFindManyMock,
      findUnique: teacherFindUniqueMock,
    },
  })),
}));

const sectionDetailRecord = {
  id: 3,
  jwId: 303,
  retiredAt: null,
  code: "SECTION-3",
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
  course: {
    id: 1,
    jwId: 101,
    code: "COURSE-1",
    nameCn: "课程 1",
    nameEn: null,
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
  },
  semester: null,
  campus: null,
  openDepartment: null,
  examMode: null,
  teachLanguage: null,
  roomType: null,
  exams: [],
  scheduleGroups: [],
  schedules: [],
  teacherAssignments: [],
  teachers: [],
  adminClasses: [],
};

function detailCacheResponse(value: unknown, expiresAt = Date.now() + 60_000) {
  return new Response(
    JSON.stringify({
      expiresAt,
      schema: "catalog-detail-core-v2",
      value,
    }),
  );
}

function detailCacheNamespace() {
  return {
    get: vi.fn(async () => null),
    put: vi.fn(async () => undefined),
  };
}

describe("shared public catalog detail cache", () => {
  beforeEach(() => {
    resetPublicRuntimeCacheForTest();
    courseFindManyMock.mockReset();
    courseFindUniqueMock.mockReset();
    sectionFindUniqueMock.mockReset();
    teacherFindManyMock.mockReset();
    teacherFindUniqueMock.mockReset();
    getCatalogDetailCacheRevisionMock.mockReset();
    getCatalogDetailCacheRevisionMock.mockResolvedValue("revision-a");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("shares course and teacher detail hits with single-id GraphQL batches", async () => {
    const course = {
      id: 1,
      jwId: 101,
      code: "COURSE-1",
      nameCn: "课程 1",
      nameEn: null,
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
      sections: [],
      _count: { sections: 0 },
    };
    const teacher = {
      id: 2,
      jwId: 202,
      personId: null,
      code: "T-2",
      nameCn: "教师",
      nameEn: "Teacher",
      email: null,
      telephone: null,
      mobile: null,
      address: null,
      departmentId: null,
      teacherTitleId: null,
      department: null,
      teacherTitle: null,
      sections: [],
      _count: { sections: 0 },
    };
    courseFindUniqueMock.mockResolvedValue(course);
    courseFindManyMock.mockResolvedValue([course]);
    teacherFindUniqueMock.mockResolvedValue(teacher);
    teacherFindManyMock.mockResolvedValue([teacher]);
    const { findCourseDetailByJwId, findCoursesByJwIds } = await import(
      "@/features/catalog/server/course-section-read-queries"
    );
    const { findTeacherDetailById, findTeachersByIds } = await import(
      "@/features/catalog/server/teacher-summary-read-model"
    );

    await expect(findCourseDetailByJwId(101, "zh-cn")).resolves.toMatchObject({
      id: 1,
      jwId: 101,
    });
    await expect(findCoursesByJwIds([101], "zh-cn")).resolves.toEqual([course]);
    await expect(findTeacherDetailById(2, "zh-cn")).resolves.toMatchObject({
      id: 2,
      jwId: 202,
      namePrimary: "教师",
    });
    await expect(findTeachersByIds([2], "zh-cn")).resolves.toEqual([teacher]);

    expect(courseFindUniqueMock).toHaveBeenCalledOnce();
    expect(courseFindManyMock).toHaveBeenCalledOnce();
    expect(teacherFindUniqueMock).toHaveBeenCalledOnce();
    expect(teacherFindManyMock).toHaveBeenCalledOnce();
  });

  it("isolates section details by locale and requested child shape", async () => {
    sectionFindUniqueMock.mockResolvedValue(sectionDetailRecord);
    const { findSectionDetailByJwId } = await import(
      "@/features/catalog/server/course-section-read-queries"
    );

    await findSectionDetailByJwId(303, "zh-cn", {
      includeExams: false,
      includeSchedules: false,
      includeTeacherDepartments: false,
    });
    await findSectionDetailByJwId(303, "zh-cn", {
      includeExams: false,
      includeSchedules: false,
      includeTeacherDepartments: false,
    });
    await findSectionDetailByJwId(303, "zh-cn", {
      includeExams: true,
      includeSchedules: false,
      includeTeacherDepartments: false,
    });
    await findSectionDetailByJwId(303, "en-us", {
      includeExams: false,
      includeSchedules: false,
      includeTeacherDepartments: false,
    });

    expect(sectionFindUniqueMock).toHaveBeenCalledTimes(3);
  });

  it("isolates runtime entries by static import revision", async () => {
    courseFindUniqueMock.mockResolvedValue({
      id: 1,
      jwId: 101,
      code: "COURSE-1",
      nameCn: "课程 1",
      nameEn: null,
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
      sections: [],
      _count: { sections: 0 },
    });
    const { findCourseDetailByJwId } = await import(
      "@/features/catalog/server/course-section-read-queries"
    );

    await findCourseDetailByJwId(101, "zh-cn");
    getCatalogDetailCacheRevisionMock.mockResolvedValue("revision-b");
    await findCourseDetailByJwId(101, "zh-cn");

    expect(courseFindUniqueMock).toHaveBeenCalledTimes(2);
  });

  it("does not retain missing detail results", async () => {
    teacherFindUniqueMock.mockResolvedValue(null);
    const { findTeacherDetailById } = await import(
      "@/features/catalog/server/teacher-summary-read-model"
    );

    await expect(findTeacherDetailById(404, "zh-cn")).resolves.toBeNull();
    await expect(findTeacherDetailById(404, "zh-cn")).resolves.toBeNull();

    expect(teacherFindUniqueMock).toHaveBeenCalledTimes(2);
  });

  it("serves a revision- and shape-scoped colo hit without waiting for KV", async () => {
    vi.stubEnv("APP_CANONICAL_ORIGIN", "https://example.test");
    const cached = { id: 1, source: "colo" };
    const match = vi.fn(async (request: Request) => {
      expect(request.url).toBe(
        "https://example.test/_life-ustc-internal-cache/catalog-detail-core/v2/revision-a/course/detail-v1/en-us/101",
      );
      return detailCacheResponse(cached);
    });
    const put = vi.fn(
      async (_request: Request, _response: Response) => undefined,
    );
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ match, put })),
    });
    const namespace = detailCacheNamespace();
    const load = vi.fn(async () => ({ id: 1, source: "origin" }));

    await expect(
      runWithCloudflareRuntimeEnv({ CATALOG_DETAIL_CORE: namespace }, () =>
        cachedPublicDetailRuntimeData({
          id: 101,
          kind: "course",
          load,
          locale: "en-us",
          shape: "detail-v1",
        }),
      ),
    ).resolves.toEqual(cached);

    expect(match).toHaveBeenCalledOnce();
    expect(namespace.get).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("writes a canonical origin result to colo and revision-scoped KV after misses", async () => {
    vi.stubEnv("APP_CANONICAL_ORIGIN", "https://example.test");
    const match = vi.fn(async () => undefined);
    const put = vi.fn(
      async (_request: Request, _response: Response) => undefined,
    );
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ match, put })),
    });
    const namespace = detailCacheNamespace();
    const scheduled: Promise<unknown>[] = [];
    const load = vi.fn(async () => ({ id: 101, source: "origin" }));
    const context = {
      waitUntil(promise: Promise<unknown>) {
        scheduled.push(promise);
      },
    };

    await runWithCloudflareRuntimeEnv(
      { CATALOG_DETAIL_CORE: namespace },
      async () => {
        await expect(
          cachedPublicDetailRuntimeData({
            id: 101,
            kind: "course",
            load,
            locale: "en-us",
            shape: "detail-v1",
          }),
        ).resolves.toEqual({ id: 101, source: "origin" });
        await Promise.all(scheduled);
      },
      context,
    );

    expect(match).toHaveBeenCalledOnce();
    expect(namespace.get).toHaveBeenCalledWith(
      "v2:revision-a:course:en-us:101:detail-v1",
      { cacheTtl: 86_400, type: "json" },
    );
    expect(namespace.put).toHaveBeenCalledOnce();
    expect(put).toHaveBeenCalledOnce();
    const [writtenRequest] = put.mock.calls[0] ?? [];
    expect((writtenRequest as Request).url).toBe(
      "https://example.test/_life-ustc-internal-cache/catalog-detail-core/v2/revision-a/course/detail-v1/en-us/101",
    );
  });

  it("keeps Cache API keys isolated by requested shape", async () => {
    vi.stubEnv("APP_CANONICAL_ORIGIN", "https://example.test");
    const requests: Request[] = [];
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({
        match: vi.fn(async (request: Request) => {
          requests.push(request);
          return undefined;
        }),
        put: vi.fn(async () => undefined),
      })),
    });
    const load = vi.fn(async () => ({ source: "origin" }));

    await runWithCloudflareRuntimeEnv(
      { CATALOG_DETAIL_CORE: detailCacheNamespace() },
      async () => {
        await cachedPublicDetailRuntimeData({
          id: 101,
          kind: "section",
          load,
          locale: "en-us",
          shape: "detail-v1:exams=false",
        });
        await cachedPublicDetailRuntimeData({
          id: 101,
          kind: "section",
          load,
          locale: "en-us",
          shape: "detail-v1:exams=true",
        });
      },
    );

    expect(requests).toHaveLength(2);
    expect(requests[0]?.url).toContain(
      "/v2/revision-a/section/detail-v1%3Aexams%3Dfalse/en-us/101",
    );
    expect(requests[1]?.url).toContain(
      "/v2/revision-a/section/detail-v1%3Aexams%3Dtrue/en-us/101",
    );
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps Cache API keys isolated by static import revision", async () => {
    vi.stubEnv("APP_CANONICAL_ORIGIN", "https://example.test");
    getCatalogDetailCacheRevisionMock
      .mockResolvedValueOnce("revision-a")
      .mockResolvedValueOnce("revision-b");
    const requests: Request[] = [];
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({
        match: vi.fn(async (request: Request) => {
          requests.push(request);
          return undefined;
        }),
        put: vi.fn(async () => undefined),
      })),
    });
    const load = vi.fn(async () => ({ source: "origin" }));

    await runWithCloudflareRuntimeEnv(
      { CATALOG_DETAIL_CORE: detailCacheNamespace() },
      async () => {
        await cachedPublicDetailRuntimeData({
          id: 101,
          kind: "teacher",
          load,
          locale: "en-us",
          shape: "detail-v1",
        });
        await cachedPublicDetailRuntimeData({
          id: 101,
          kind: "teacher",
          load,
          locale: "en-us",
          shape: "detail-v1",
        });
      },
    );

    expect(requests.map((request) => request.url)).toEqual([
      "https://example.test/_life-ustc-internal-cache/catalog-detail-core/v2/revision-a/teacher/detail-v1/en-us/101",
      "https://example.test/_life-ustc-internal-cache/catalog-detail-core/v2/revision-b/teacher/detail-v1/en-us/101",
    ]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["null", null],
    ["primitive", "invalid"],
  ])("does not cache %s detail results", async (_name, loadResult) => {
    vi.stubEnv("APP_CANONICAL_ORIGIN", "https://example.test");
    const match = vi.fn(async () => undefined);
    const put = vi.fn(async () => undefined);
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ match, put })),
    });
    const namespace = detailCacheNamespace();
    const scheduled: Promise<unknown>[] = [];
    const context = {
      waitUntil(promise: Promise<unknown>) {
        scheduled.push(promise);
      },
    };

    await runWithCloudflareRuntimeEnv(
      { CATALOG_DETAIL_CORE: namespace },
      async () => {
        await expect(
          cachedPublicDetailRuntimeData<unknown>({
            id: 101,
            kind: "course",
            load: async () => loadResult,
            locale: "en-us",
            shape: `invalid-${_name}`,
          }),
        ).resolves.toBe(loadResult);
        await Promise.all(scheduled);
      },
      context,
    );

    expect(namespace.put).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(0);
  });
});
