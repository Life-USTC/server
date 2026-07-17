import { describe, expect, it } from "vitest";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

type SearchSectionsResult = {
  data?: Array<{
    id?: number;
    jwId?: number;
    code?: string | null;
    credits?: number | null;
    stdCount?: number | null;
    limitCount?: number | null;
    courseId?: number | null;
    course?: {
      id?: number;
      jwId?: number;
      code?: string | null;
      nameCn?: string | null;
      nameEn?: string | null;
    };
    semester?: {
      id?: number;
      jwId?: number;
      nameCn?: string | null;
      code?: string | null;
    };
    campus?: {
      id?: number;
      jwId?: number;
      nameCn?: string | null;
      nameEn?: string | null;
      code?: string | null;
    };
    teachers?: Array<{
      id?: number;
      code?: string | null;
      nameCn?: string | null;
      nameEn?: string | null;
    }>;
  }>;
  pagination?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
};

type GetCourseResult = {
  found?: boolean;
  course?: {
    id?: number;
    jwId?: number;
    code?: string | null;
    nameCn?: string | null;
    nameEn?: string | null;
    educationLevel?: { nameCn?: string | null; nameEn?: string | null } | null;
    category?: { nameCn?: string | null; nameEn?: string | null } | null;
    classType?: { nameCn?: string | null; nameEn?: string | null } | null;
    sections?: Array<{
      id?: number;
      jwId?: number;
      code?: string | null;
      semester?: { nameCn?: string | null } | null;
      campus?: { nameCn?: string | null } | null;
      teachers?: Array<{ nameCn?: string | null }>;
    }>;
  } | null;
};

describe("班级搜索工具 search_sections", () => {
  it("按课程 jwId 返回分页的班级摘要", async () => {
    const result = await context.client.call<SearchSectionsResult>(
      "search_sections",
      {
        courseJwId: fixtures.DEV_SEED.course.jwId,
        page: 1,
        limit: 10,
        locale: "zh-cn",
        mode: "full",
      },
    );

    expect(result.pagination?.page).toBe(1);
    expect(result.pagination?.pageSize).toBe(10);
    expect((result.pagination?.total ?? 0) > 0).toBe(true);
    expect((result.pagination?.totalPages ?? 0) >= 1).toBe(true);

    const section = result.data?.find(
      (item) => item.jwId === fixtures.DEV_SEED.section.jwId,
    );
    expect(section).toBeDefined();
    expect(section?.code).toBe(fixtures.DEV_SEED.section.code);
    expect(section?.course?.jwId).toBe(fixtures.DEV_SEED.course.jwId);
    expect(section?.course?.nameCn).toBe(fixtures.DEV_SEED.course.nameCn);
    expect(section?.course?.nameEn).toBe(fixtures.DEV_SEED.course.nameEn);
    expect(section?.semester?.jwId).toBe(fixtures.DEV_SEED.semesterJwId);
    expect(
      section?.teachers?.some(
        (teacher) => teacher.code === fixtures.DEV_SEED.teacher.code,
      ),
    ).toBe(true);
  });

  it("按课程 legacy jwId 返回 canonical 课程的班级摘要", async () => {
    const result = await context.client.call<SearchSectionsResult>(
      "search_sections",
      {
        courseJwId: fixtures.DEV_SEED.course.legacyJwId,
        page: 1,
        limit: 10,
        locale: "zh-cn",
        mode: "full",
      },
    );

    const section = result.data?.find(
      (item) => item.jwId === fixtures.DEV_SEED.section.jwId,
    );
    expect(section).toBeDefined();
    expect(section?.course?.jwId).toBe(fixtures.DEV_SEED.course.jwId);
    expect(result.pagination?.total).toBeGreaterThan(0);
  });

  it("按教师工号过滤班级", async () => {
    const result = await context.client.call<SearchSectionsResult>(
      "search_sections",
      {
        teacherCode: fixtures.DEV_SEED.teacher.code,
        page: 1,
        limit: 10,
        locale: "zh-cn",
        mode: "full",
      },
    );

    expect((result.data?.length ?? 0) > 0).toBe(true);
    expect(
      result.data?.some(
        (section) => section.jwId === fixtures.DEV_SEED.section.jwId,
      ),
    ).toBe(true);
  });

  it("按 jwIds 精确查询班级", async () => {
    const result = await context.client.call<SearchSectionsResult>(
      "search_sections",
      {
        jwIds: [fixtures.DEV_SEED.section.jwId],
        page: 1,
        limit: 10,
        locale: "zh-cn",
        mode: "full",
      },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]?.jwId).toBe(fixtures.DEV_SEED.section.jwId);
    expect(result.pagination?.total).toBe(1);
    expect(result.pagination?.totalPages).toBe(1);
  });

  it("无匹配过滤返回空分页", async () => {
    const result = await context.client.call<SearchSectionsResult>(
      "search_sections",
      {
        courseJwId: 999_999_999,
        page: 1,
        limit: 10,
        locale: "zh-cn",
        mode: "full",
      },
    );

    expect(result.data).toEqual([]);
    expect(result.pagination?.total).toBe(0);
    expect(result.pagination?.totalPages).toBe(1);
  });

  it("拒绝越界分页参数", async () => {
    await expect(
      context.client.call("search_sections", { page: 1, limit: 101 }),
    ).rejects.toThrow();
    await expect(
      context.client.call("search_sections", { page: 0, limit: 10 }),
    ).rejects.toThrow();
  });
});

describe("课程详情工具 get_course_by_jw_id", () => {
  it("按 jwId 返回课程详情及班级列表", async () => {
    const result = await context.client.call<GetCourseResult>(
      "get_course_by_jw_id",
      {
        jwId: fixtures.DEV_SEED.course.jwId,
        locale: "zh-cn",
        mode: "full",
      },
    );

    expect(result.found).toBe(true);
    const course = result.course;
    expect(course).not.toBeNull();
    expect(course?.jwId).toBe(fixtures.DEV_SEED.course.jwId);
    expect(course?.code).toBe(fixtures.DEV_SEED.course.code);
    expect(course?.nameCn).toBe(fixtures.DEV_SEED.course.nameCn);
    expect(course?.nameEn).toBe(fixtures.DEV_SEED.course.nameEn);
    expect(course?.educationLevel?.nameCn).toBe(
      fixtures.DEV_SEED.course.educationLevelNameCn,
    );
    expect(course?.category?.nameCn).toBe(
      fixtures.DEV_SEED.course.categoryNameCn,
    );
    expect(course?.classType?.nameCn).toBe(
      fixtures.DEV_SEED.course.classTypeNameCn,
    );

    const seedSection = course?.sections?.find(
      (section) => section.jwId === fixtures.DEV_SEED.section.jwId,
    );
    expect(seedSection).toBeDefined();
    expect(seedSection?.code).toBe(fixtures.DEV_SEED.section.code);
    expect(seedSection?.semester?.nameCn).toBe(
      fixtures.DEV_SEED.semesterNameCn,
    );
  });

  it("缺失课程返回 found false", async () => {
    const result = await context.client.call<GetCourseResult>(
      "get_course_by_jw_id",
      {
        jwId: 999_999_999,
        locale: "zh-cn",
      },
    );

    expect(result.found).toBe(false);
    expect(result.course).toBeNull();
  });

  it("拒绝无效 jwId 参数", async () => {
    await expect(
      context.client.call("get_course_by_jw_id", { jwId: 0 }),
    ).rejects.toThrow();
    await expect(
      context.client.call("get_course_by_jw_id", { jwId: -1 }),
    ).rejects.toThrow();
    await expect(
      context.client.call("get_course_by_jw_id", {
        jwId: "not-a-number",
      }),
    ).rejects.toThrow();
  });
});
