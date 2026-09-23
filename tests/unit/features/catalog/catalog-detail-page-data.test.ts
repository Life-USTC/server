import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";

const {
  courseFindManyMock,
  courseFindUniqueMock,
  getCatalogDetailCacheRevisionMock,
  teacherFindUniqueMock,
} = vi.hoisted(() => ({
  courseFindManyMock: vi.fn(),
  courseFindUniqueMock: vi.fn(),
  getCatalogDetailCacheRevisionMock: vi.fn(),
  teacherFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    course: {
      findMany: courseFindManyMock,
      findUnique: courseFindUniqueMock,
    },
    teacher: { findUnique: teacherFindUniqueMock },
  }),
}));

vi.mock("@/lib/catalog-detail-cache-revision", () => ({
  getCatalogDetailCacheRevision: getCatalogDetailCacheRevisionMock,
}));

function prismaThenable<T>(value: T): PromiseLike<T> {
  return {
    // biome-ignore lint/suspicious/noThenProperty: Prisma queries intentionally return thenables.
    then(onfulfilled, onrejected) {
      return Promise.resolve(value).then(onfulfilled, onrejected);
    },
  };
}

function localizedName(nameCn: string) {
  const nameEn = `${nameCn} EN`;
  return {
    nameCn,
    nameEn,
    namePrimary: nameCn,
    nameSecondary: nameEn,
  };
}

function coursePageSection(overrides: object = {}) {
  return {
    jwId: 301,
    code: "001",
    stdCount: null,
    limitCount: null,
    semester: null,
    campus: null,
    teachers: [],
    ...overrides,
  };
}

function teacherPageSection(overrides: object = {}) {
  return {
    jwId: 302,
    code: "002",
    credits: null,
    course: localizedName("Course"),
    semester: null,
    ...overrides,
  };
}

function coursePage(overrides: object = {}) {
  return {
    id: 11,
    jwId: 101,
    code: "MATH1001",
    ...localizedName("Calculus"),
    educationLevel: null,
    category: null,
    classType: null,
    type: null,
    sections: [],
    ...overrides,
  };
}

function teacherPage(overrides: object = {}) {
  return {
    id: 21,
    ...localizedName("Ada"),
    email: null,
    telephone: null,
    mobile: null,
    address: null,
    department: null,
    teacherTitle: null,
    sections: [],
    ...overrides,
  };
}

function detailCacheEnvelope(value: unknown) {
  return {
    expiresAt: Date.now() + 60_000,
    schema: "catalog-detail-core-v2",
    value,
  };
}

describe("catalog detail page data", () => {
  beforeEach(() => {
    resetPublicRuntimeCacheForTest();
    vi.clearAllMocks();
    getCatalogDetailCacheRevisionMock.mockResolvedValue("test-revision");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads a course without unused comment queries", async () => {
    const course = coursePage();
    courseFindUniqueMock.mockResolvedValue(course);

    const { getCoursePage } = await import(
      "@/features/catalog/server/course-page-data"
    );
    const result = await getCoursePage(course.jwId, "zh-cn");

    expect(result).toEqual(course);
    expect(courseFindUniqueMock).toHaveBeenCalledTimes(1);
    expect(courseFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jwId: course.jwId } }),
    );
    const courseSelect = courseFindUniqueMock.mock.calls[0]?.[0]?.select;
    expect(courseSelect).not.toHaveProperty("description");
    expect(courseSelect).not.toHaveProperty("_count");
    expect(courseSelect?.sections?.take).toBe(20);
    expect(result).not.toHaveProperty("commentCount");
    expect(result).not.toHaveProperty("latestComments");
  });

  it("loads a teacher without unused comment queries", async () => {
    const teacher = teacherPage();
    teacherFindUniqueMock.mockResolvedValue(teacher);

    const { getTeacherPage } = await import(
      "@/features/catalog/server/teacher-page-data"
    );
    const result = await getTeacherPage(teacher.id, "zh-cn");

    expect(result).toEqual(teacher);
    const teacherSelect = teacherFindUniqueMock.mock.calls[0]?.[0]?.select;
    expect(teacherSelect).not.toHaveProperty("description");
    expect(teacherSelect).not.toHaveProperty("_count");
    expect(teacherSelect?.sections?.take).toBe(20);
    expect(result).not.toHaveProperty("commentCount");
    expect(result).not.toHaveProperty("latestComments");
  });

  it("coalesces concurrent course core misses within the isolate", async () => {
    let resolveCourse: ((value: unknown) => void) | undefined;
    const course = coursePage();
    courseFindUniqueMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCourse = resolve;
      }),
    );

    const { getCoursePage } = await import(
      "@/features/catalog/server/course-page-data"
    );
    const first = getCoursePage(course.jwId, "zh-cn");
    const second = getCoursePage(course.jwId, "zh-cn");

    await vi.waitFor(() => {
      expect(courseFindUniqueMock).toHaveBeenCalledOnce();
    });
    resolveCourse?.(course);

    await expect(Promise.all([first, second])).resolves.toEqual([
      course,
      course,
    ]);
    expect(courseFindUniqueMock).toHaveBeenCalledOnce();
  });

  it("reuses the immutable teacher core without caching request data", async () => {
    const teacher = teacherPage({
      address: "Campus",
      email: "teacher@example.test",
    });
    teacherFindUniqueMock.mockResolvedValue(teacher);

    const { getTeacherPage } = await import(
      "@/features/catalog/server/teacher-page-data"
    );
    const first = await getTeacherPage(teacher.id, "zh-cn");
    const second = await getTeacherPage(teacher.id, "zh-cn");

    expect(second).toEqual(first);
    expect(teacherFindUniqueMock).toHaveBeenCalledOnce();
    expect(first).not.toHaveProperty("viewer");
    expect(first).not.toHaveProperty("description");
    expect(first).not.toHaveProperty("comments");
  });

  it("isolates course core entries by locale and static revision", async () => {
    courseFindUniqueMock.mockResolvedValue(coursePage());
    const { getCoursePage } = await import(
      "@/features/catalog/server/course-page-data"
    );

    await getCoursePage(101, "zh-cn");
    await getCoursePage(101, "en-us");
    await getCoursePage(101, "zh-cn");
    expect(courseFindUniqueMock).toHaveBeenCalledTimes(2);

    getCatalogDetailCacheRevisionMock.mockResolvedValue("next-revision");
    await getCoursePage(101, "zh-cn");
    expect(courseFindUniqueMock).toHaveBeenCalledTimes(3);
  });

  it("uses a distinct bounded page-core cache shape", async () => {
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
    courseFindUniqueMock.mockResolvedValue(coursePage());

    const { getCoursePage } = await import(
      "@/features/catalog/server/course-page-data"
    );
    await runWithCloudflareRuntimeEnv({}, () => getCoursePage(101, "en-us"));

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      "https://example.test/_life-ustc-internal-cache/catalog-detail-core/v2/test-revision/course/page-core-v1/en-us/101",
    );
  });

  it("reloads a course when KV contains a corrupt page core", async () => {
    const course = coursePage();
    const namespace = {
      get: vi.fn(async () =>
        detailCacheEnvelope(
          coursePage({
            viewer: { userId: "must-not-be-cached" },
          }),
        ),
      ),
      put: vi.fn(async () => undefined),
    };
    const match = vi.fn(async () => undefined);
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({
        match,
        put: vi.fn(async () => undefined),
      })),
    });
    courseFindUniqueMock.mockResolvedValue(course);

    const { getCoursePage } = await import(
      "@/features/catalog/server/course-page-data"
    );
    const result = await runWithCloudflareRuntimeEnv(
      { CATALOG_DETAIL_CORE: namespace },
      () => getCoursePage(course.jwId, "zh-cn"),
    );

    expect(result).toEqual(course);
    expect(courseFindUniqueMock).toHaveBeenCalledOnce();
    expect(namespace.get).toHaveBeenCalledOnce();
    expect(match).toHaveBeenCalledOnce();
  });

  it("reloads a course when Cache API contains a corrupt nested core", async () => {
    const course = coursePage();
    const match = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            detailCacheEnvelope(
              coursePage({
                sections: [
                  coursePageSection({
                    teachers: [
                      { ...localizedName("Teacher"), email: "private" },
                    ],
                  }),
                ],
              }),
            ),
          ),
        ),
    );
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({
        match,
        put: vi.fn(async () => undefined),
      })),
    });
    courseFindUniqueMock.mockResolvedValue(course);

    const { getCoursePage } = await import(
      "@/features/catalog/server/course-page-data"
    );
    const result = await runWithCloudflareRuntimeEnv({}, () =>
      getCoursePage(course.jwId, "zh-cn"),
    );

    expect(result).toEqual(course);
    expect(courseFindUniqueMock).toHaveBeenCalledOnce();
    expect(match).toHaveBeenCalledOnce();
  });

  it("reloads a teacher when Cache API contains a corrupt nested core", async () => {
    const teacher = teacherPage();
    const match = vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            detailCacheEnvelope(
              teacherPage({
                sections: [
                  teacherPageSection({
                    course: {
                      ...localizedName("Course"),
                      viewer: { userId: "must-not-be-cached" },
                    },
                  }),
                ],
              }),
            ),
          ),
        ),
    );
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({
        match,
        put: vi.fn(async () => undefined),
      })),
    });
    teacherFindUniqueMock.mockResolvedValue(teacher);

    const { getTeacherPage } = await import(
      "@/features/catalog/server/teacher-page-data"
    );
    const result = await runWithCloudflareRuntimeEnv({}, () =>
      getTeacherPage(teacher.id, "zh-cn"),
    );

    expect(result).toEqual(teacher);
    expect(teacherFindUniqueMock).toHaveBeenCalledOnce();
    expect(match).toHaveBeenCalledOnce();
  });

  it("reloads a teacher when KV contains a corrupt page core", async () => {
    const teacher = teacherPage();
    const namespace = {
      get: vi.fn(async () =>
        detailCacheEnvelope(
          teacherPage({
            email: { leaked: true },
          }),
        ),
      ),
      put: vi.fn(async () => undefined),
    };
    const match = vi.fn(async () => undefined);
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({
        match,
        put: vi.fn(async () => undefined),
      })),
    });
    teacherFindUniqueMock.mockResolvedValue(teacher);

    const { getTeacherPage } = await import(
      "@/features/catalog/server/teacher-page-data"
    );
    const result = await runWithCloudflareRuntimeEnv(
      { CATALOG_DETAIL_CORE: namespace },
      () => getTeacherPage(teacher.id, "zh-cn"),
    );

    expect(result).toEqual(teacher);
    expect(teacherFindUniqueMock).toHaveBeenCalledOnce();
    expect(namespace.get).toHaveBeenCalledOnce();
    expect(match).toHaveBeenCalledOnce();
  });

  it("keeps representative page-core cache envelopes below the payload guard", () => {
    const course = coursePage({
      sections: Array.from({ length: 20 }, (_, index) =>
        coursePageSection({
          code: `COURSE-${index + 1}`,
          jwId: 301 + index,
          teachers: [localizedName(`Teacher ${index + 1}`)],
        }),
      ),
    });
    const teacher = teacherPage({
      sections: Array.from({ length: 20 }, (_, index) =>
        teacherPageSection({
          code: `SECTION-${index + 1}`,
          jwId: 401 + index,
          course: localizedName(`Course ${index + 1}`),
        }),
      ),
    });
    const maxPayloadBytes = 256 * 1024;

    for (const value of [course, teacher]) {
      const serialized = JSON.stringify(detailCacheEnvelope(value));
      expect(new TextEncoder().encode(serialized).byteLength).toBeLessThan(
        maxPayloadBytes,
      );
    }
  });

  it("strips Prisma extension symbols before returning load data", async () => {
    const localizedNameSymbol = Symbol("localizedName");
    const courseSections = [coursePageSection()];
    courseFindUniqueMock.mockResolvedValue({
      ...coursePage({ sections: courseSections }),
      [localizedNameSymbol]: "course",
    });
    const teacherSections = [teacherPageSection()];
    teacherFindUniqueMock.mockResolvedValue({
      ...teacherPage({ sections: teacherSections }),
      [localizedNameSymbol]: "teacher",
    });

    const [{ getCoursePage }, { getTeacherPage }] = await Promise.all([
      import("@/features/catalog/server/course-page-data"),
      import("@/features/catalog/server/teacher-page-data"),
    ]);
    const [courseResult, teacherResult] = await Promise.all([
      getCoursePage(101),
      getTeacherPage(21),
    ]);

    expect(courseResult?.sections).toEqual(courseSections);
    expect(teacherResult?.sections).toEqual(teacherSections);
    expect(
      courseFindUniqueMock.mock.calls.at(-1)?.[0]?.select?.sections?.take,
    ).toBe(20);
    expect(
      teacherFindUniqueMock.mock.calls.at(-1)?.[0]?.select?.sections?.take,
    ).toBe(20);
    expect(Reflect.ownKeys(courseResult ?? {})).not.toContain(
      localizedNameSymbol,
    );
    expect(Reflect.ownKeys(teacherResult ?? {})).not.toContain(
      localizedNameSymbol,
    );
  });

  it("traces bounded course and teacher query phases", async () => {
    courseFindUniqueMock.mockReturnValue(prismaThenable(coursePage()));
    teacherFindUniqueMock.mockReturnValue(prismaThenable(teacherPage()));
    const [{ getCoursePage }, { getTeacherPage }] = await Promise.all([
      import("@/features/catalog/server/course-page-data"),
      import("@/features/catalog/server/teacher-page-data"),
    ]);
    const spans: Array<{
      attributes: Record<string, boolean | number | string | undefined>;
      name: string;
    }> = [];
    const nativePromiseSpans: string[] = [];

    await runWithCloudflareRuntimeEnv(
      {},
      async () => {
        await getCoursePage(101);
        await getTeacherPage(21);
      },
      {
        tracing: {
          enterSpan<T>(
            name: string,
            callback: (span: {
              isTraced: boolean;
              setAttribute(
                key: string,
                value?: boolean | number | string,
              ): void;
            }) => T,
          ) {
            const attributes: Record<
              string,
              boolean | number | string | undefined
            > = {};
            spans.push({ attributes, name });
            const result = callback({
              isTraced: true,
              setAttribute(key, value) {
                attributes[key] = value;
              },
            });
            if (result instanceof Promise) nativePromiseSpans.push(name);
            return result;
          },
        },
      },
    );

    expect(spans).toEqual(
      expect.arrayContaining([
        {
          attributes: expect.objectContaining({
            "cache.layer": "colo",
            "cache.namespace": "catalog:course-detail:zh-cn",
          }),
          name: "cache.colo.read",
        },
        {
          attributes: { "catalog.detail.kind": "course" },
          name: "catalog.detail.course.query",
        },
        {
          attributes: { "catalog.detail.kind": "course" },
          name: "catalog.detail.course.transform",
        },
        {
          attributes: expect.objectContaining({
            "cache.layer": "colo",
            "cache.namespace": "catalog:teacher-detail:zh-cn",
          }),
          name: "cache.colo.read",
        },
        {
          attributes: { "catalog.detail.kind": "teacher" },
          name: "catalog.detail.teacher.query",
        },
        {
          attributes: { "catalog.detail.kind": "teacher" },
          name: "catalog.detail.teacher.transform",
        },
      ]),
    );
    expect(JSON.stringify(spans)).not.toContain("101");
    expect(JSON.stringify(spans)).not.toContain("21");
    expect(nativePromiseSpans).toEqual(
      expect.arrayContaining([
        "catalog.detail.course.query",
        "catalog.detail.teacher.query",
      ]),
    );
  });
});
