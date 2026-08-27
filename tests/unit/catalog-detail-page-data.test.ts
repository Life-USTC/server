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
    const course = {
      code: "MATH1001",
      id: 11,
      jwId: 101,
      sections: [],
    };
    courseFindUniqueMock.mockResolvedValue(course);

    const { getCoursePage } = await import(
      "@/features/catalog/server/course-page-data"
    );
    const result = await getCoursePage(course.jwId, "zh-cn");

    expect(result).toEqual({
      code: course.code,
      id: course.id,
      jwId: course.jwId,
      sections: [],
    });
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
    const teacher = {
      id: 21,
      namePrimary: "Ada",
      sections: [],
    };
    teacherFindUniqueMock.mockResolvedValue(teacher);

    const { getTeacherPage } = await import(
      "@/features/catalog/server/teacher-page-data"
    );
    const result = await getTeacherPage(teacher.id, "zh-cn");

    expect(result).toEqual({
      id: teacher.id,
      namePrimary: teacher.namePrimary,
      sections: [],
    });
    const teacherSelect = teacherFindUniqueMock.mock.calls[0]?.[0]?.select;
    expect(teacherSelect).not.toHaveProperty("description");
    expect(teacherSelect).not.toHaveProperty("_count");
    expect(teacherSelect?.sections?.take).toBe(20);
    expect(result).not.toHaveProperty("commentCount");
    expect(result).not.toHaveProperty("latestComments");
  });

  it("coalesces concurrent course core misses within the isolate", async () => {
    let resolveCourse: ((value: unknown) => void) | undefined;
    const course = { code: "MATH1001", id: 11, jwId: 101, sections: [] };
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
    const teacher = {
      address: "Campus",
      email: "teacher@example.test",
      id: 21,
      namePrimary: "Ada",
      sections: [],
    };
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
    courseFindUniqueMock.mockResolvedValue({
      code: "MATH1001",
      id: 11,
      jwId: 101,
      sections: [],
    });
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
    courseFindUniqueMock.mockResolvedValue({
      code: "MATH1001",
      id: 11,
      jwId: 101,
      sections: [],
    });

    const { getCoursePage } = await import(
      "@/features/catalog/server/course-page-data"
    );
    await runWithCloudflareRuntimeEnv({}, () => getCoursePage(101, "en-us"));

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      "https://example.test/_life-ustc-internal-cache/catalog-detail-core/v2/test-revision/course/page-core-v1/en-us/101",
    );
  });

  it("strips Prisma extension symbols before returning load data", async () => {
    const localizedNameSymbol = Symbol("localizedName");
    const courseSections = [{ code: "001", jwId: 301 }];
    courseFindUniqueMock.mockResolvedValue({
      id: 11,
      jwId: 101,
      [localizedNameSymbol]: "course",
      sections: courseSections,
    });
    const teacherSections = [{ code: "002", jwId: 302 }];
    teacherFindUniqueMock.mockResolvedValue({
      id: 21,
      [localizedNameSymbol]: "teacher",
      sections: teacherSections,
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
    courseFindUniqueMock.mockReturnValue(
      prismaThenable({
        id: 11,
        jwId: 101,
        sections: [],
      }),
    );
    teacherFindUniqueMock.mockReturnValue(
      prismaThenable({ id: 21, sections: [] }),
    );
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
