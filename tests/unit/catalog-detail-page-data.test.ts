import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const { courseFindManyMock, courseFindUniqueMock, teacherFindUniqueMock } =
  vi.hoisted(() => ({
    courseFindManyMock: vi.fn(),
    courseFindUniqueMock: vi.fn(),
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
    vi.clearAllMocks();
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

    expect(spans).toEqual([
      {
        attributes: { "catalog.detail.kind": "course" },
        name: "catalog.detail.course.query",
      },
      {
        attributes: { "catalog.detail.kind": "course" },
        name: "catalog.detail.course.transform",
      },
      {
        attributes: { "catalog.detail.kind": "teacher" },
        name: "catalog.detail.teacher.query",
      },
      {
        attributes: { "catalog.detail.kind": "teacher" },
        name: "catalog.detail.teacher.transform",
      },
    ]);
    expect(JSON.stringify(spans)).not.toContain("101");
    expect(JSON.stringify(spans)).not.toContain("21");
    expect(nativePromiseSpans).toEqual([
      "catalog.detail.course.query",
      "catalog.detail.teacher.query",
    ]);
  });
});
