// Merged from mcp-08-catalog + mcp-13-catalog-search + mcp-14-teacher + mcp-15-section-match

import { describe, expect, it } from "vitest";
import * as fixtures from "../_harness";

const context = fixtures.createMcpToolTestContext();

describe("课程与班级查找", () => {
  it("catalog_course_search 返回 REST 等价分页课程层级", async () => {
    const seedCourseFilters = await fixtures.prisma.course.findUnique({
      where: { jwId: fixtures.DEV_SEED.course.jwId },
      select: {
        categoryId: true,
        classTypeId: true,
        educationLevelId: true,
      },
    });
    expect(seedCourseFilters).toBeTruthy();

    const args: Record<string, unknown> = {
      limit: 10,
      locale: "zh-cn",
      mode: "full",
      page: 1,
    };
    for (const [key, value] of Object.entries(seedCourseFilters ?? {})) {
      if (value != null) args[key] = value;
    }

    const result = await context.client.call<{
      data?: Array<{
        jwId?: number;
        code?: string | null;
        nameCn?: string | null;
        educationLevel?: { nameCn?: string | null } | null;
        category?: { nameCn?: string | null } | null;
        classType?: { nameCn?: string | null } | null;
      }>;
      pagination?: {
        page?: number;
        pageSize?: number;
        total?: number;
        totalPages?: number;
      };
    }>("catalog_course_search", args);

    expect(result.pagination?.page).toBe(1);
    expect(result.pagination?.pageSize).toBe(10);
    expect(result.pagination?.total).toBeGreaterThan(0);
    expect(result.pagination?.totalPages).toBeGreaterThanOrEqual(1);

    const course = result.data?.find(
      (item) => item.jwId === fixtures.DEV_SEED.course.jwId,
    );
    expect(course?.code).toBe(fixtures.DEV_SEED.course.code);
    expect(course?.nameCn).toBe(fixtures.DEV_SEED.course.nameCn);
    expect(course?.educationLevel?.nameCn).toBe(
      fixtures.DEV_SEED.course.educationLevelNameCn,
    );
    expect(course?.category?.nameCn).toBe(
      fixtures.DEV_SEED.course.categoryNameCn,
    );
    expect(course?.classType?.nameCn).toBe(
      fixtures.DEV_SEED.course.classTypeNameCn,
    );
  });

  it("catalog_course_get 接受旧 jwId 并返回 canonical 课程", async () => {
    const result = await context.client.call<{
      found?: boolean;
      course?: { jwId?: number; code?: string };
    }>("catalog_course_get", {
      jwId: fixtures.DEV_SEED.course.legacyJwId,
      locale: "zh-cn",
      mode: "full",
    });

    expect(result.found).toBe(true);
    expect(result.course).toMatchObject({
      jwId: fixtures.DEV_SEED.course.jwId,
      code: fixtures.DEV_SEED.course.code,
    });
  });

  it("catalog_section_get 返回与 REST 班级详情相同的层级", async () => {
    const result = await context.client.call<{
      found?: boolean;
      section?: {
        code?: string;
        schedules?: Array<{
          endTime?: unknown;
          startTime?: unknown;
        }>;
        teacherAssignments?: unknown[];
        scheduleGroups?: unknown[];
        exams?: unknown[];
        roomType?: unknown;
      };
    }>("catalog_section_get", {
      jwId: fixtures.DEV_SEED.section.jwId,
      locale: "zh-cn",
      mode: "full",
    });

    expect(result.found).toBe(true);
    expect(result.section?.code).toBe(fixtures.DEV_SEED.section.code);
    expect(typeof result.section?.schedules?.[0]?.startTime).toBe("string");
    expect(typeof result.section?.schedules?.[0]?.endTime).toBe("string");
    expect((result.section?.teacherAssignments?.length ?? 0) > 0).toBe(true);
    expect(Array.isArray(result.section?.scheduleGroups)).toBe(true);
    expect((result.section?.exams?.length ?? 0) > 0).toBe(true);
    expect(Object.hasOwn(result.section ?? {}, "roomType")).toBe(true);
  });

  it("catalog_section_get 在 jwId 缺失时返回恢复提示", async () => {
    const result = await context.client.call<{
      found?: boolean;
      message?: string;
      hint?: string;
    }>("catalog_section_get", {
      jwId: 999999999,
      locale: "zh-cn",
    });

    expect(result.found).toBe(false);
    expect(result.message).toContain("999999999");
    expect(result.hint).toContain("catalog_section_search");
  });
});

// ---------------------------------------------------------------------------
// Dashboard snapshot — compact shape verification
// ---------------------------------------------------------------------------

// --- formerly mcp-13-catalog-search ---

describe("学期查询工具", () => {
  it("catalog_semester_list 返回与 REST 等价的分页学期列表", async () => {
    const result = await context.client.call<{
      data?: Array<{
        id?: number;
        jwId?: number;
        code?: string;
        nameCn?: string;
        startDate?: string;
        endDate?: string;
      }>;
      pagination?: {
        page?: number;
        pageSize?: number;
        total?: number;
        totalPages?: number;
      };
    }>("catalog_semester_list", {
      page: 1,
      limit: 20,
      mode: "default",
    });

    expect(result.pagination?.page).toBe(1);
    expect(result.pagination?.pageSize).toBe(20);
    expect((result.pagination?.total ?? 0) > 0).toBe(true);
    expect((result.pagination?.totalPages ?? 0) >= 1).toBe(true);

    const semester = result.data?.find(
      (item) => item.jwId === fixtures.DEV_SEED.semesterJwId,
    );
    expect(semester).toBeDefined();
    expect(semester?.nameCn).toBe(fixtures.DEV_SEED.semesterNameCn);
    expect(typeof semester?.id).toBe("number");
    expect(typeof semester?.code).toBe("string");
    expect(typeof semester?.startDate).toBe("string");
    expect(typeof semester?.endDate).toBe("string");
  });

  it("catalog_semester_list summary 兼容输入保留标准分页数组", async () => {
    const result = await context.client.call<{
      data?: Array<{
        jwId?: number;
        nameCn?: string;
      }>;
      pagination?: {
        total?: number;
        page?: number;
        pageSize?: number;
      };
    }>("catalog_semester_list", {
      page: 1,
      limit: 10,
      mode: "summary",
    });

    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.pagination?.total).toBe("number");
    expect(result.pagination?.page).toBe(1);
    expect(result.pagination?.pageSize).toBe(10);

    const semester = result.data?.find(
      (item) => item.jwId === fixtures.DEV_SEED.semesterJwId,
    );
    expect(semester?.nameCn).toBe(fixtures.DEV_SEED.semesterNameCn);
  });

  it("catalog_semester_list 越界页码返回空数据与正确分页元数据", async () => {
    const result = await context.client.call<{
      data?: unknown[];
      pagination?: {
        page?: number;
        pageSize?: number;
        total?: number;
        totalPages?: number;
      };
    }>("catalog_semester_list", {
      page: 9999,
      limit: 10,
      mode: "default",
    });

    expect(result.data).toHaveLength(0);
    expect(result.pagination?.page).toBe(9999);
    expect(result.pagination?.pageSize).toBe(10);
    expect((result.pagination?.total ?? 0) > 0).toBe(true);
    expect(result.pagination?.totalPages).toBeGreaterThanOrEqual(1);
  });

  it("catalog_semester_list 拒绝越界或无效分页参数", async () => {
    await expect(
      context.client.call("catalog_semester_list", { page: 0, limit: 10 }),
    ).rejects.toThrow();

    await expect(
      context.client.call("catalog_semester_list", { page: 1, limit: 101 }),
    ).rejects.toThrow();

    await expect(
      context.client.call("catalog_semester_list", {
        page: "not-a-number",
        limit: 10,
      }),
    ).rejects.toThrow();
  });

  it("catalog_semester_current 返回覆盖当前的 seed 学期", async () => {
    const result = await context.client.call<{
      found?: boolean;
      semester?: {
        id?: number;
        jwId?: number;
        code?: string;
        nameCn?: string;
        startDate?: string;
        endDate?: string;
      };
    }>("catalog_semester_current", { mode: "default" });

    expect(result.found).toBe(true);
    expect(result.semester?.jwId).toBe(fixtures.DEV_SEED.semesterJwId);
    expect(result.semester?.nameCn).toBe(fixtures.DEV_SEED.semesterNameCn);
    expect(typeof result.semester?.id).toBe("number");
    expect(typeof result.semester?.code).toBe("string");
    expect(typeof result.semester?.startDate).toBe("string");
    expect(typeof result.semester?.endDate).toBe("string");
  });

  it("catalog_semester_current full 模式返回完整学期记录", async () => {
    const result = await context.client.call<{
      found?: boolean;
      semester?: Record<string, unknown>;
    }>("catalog_semester_current", { mode: "full" });

    expect(result.found).toBe(true);
    expect(result.semester?.jwId).toBe(fixtures.DEV_SEED.semesterJwId);
    expect(result.semester).toHaveProperty("id");
    expect(result.semester).toHaveProperty("nameCn");
    expect(result.semester).toHaveProperty("startDate");
    expect(result.semester).toHaveProperty("endDate");
  });

  it("catalog_semester_current 拒绝无效 mode 参数", async () => {
    await expect(
      context.client.call("catalog_semester_current", { mode: "invalid-mode" }),
    ).rejects.toThrow();
  });
});

// --- formerly mcp-14-teacher ---

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

describe("班级搜索工具 catalog_section_search", () => {
  it("按课程 jwId 返回分页的班级摘要", async () => {
    const result = await context.client.call<SearchSectionsResult>(
      "catalog_section_search",
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
      "catalog_section_search",
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
      "catalog_section_search",
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
      "catalog_section_search",
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
      "catalog_section_search",
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
      context.client.call("catalog_section_search", { page: 1, limit: 101 }),
    ).rejects.toThrow();
    await expect(
      context.client.call("catalog_section_search", { page: 0, limit: 10 }),
    ).rejects.toThrow();
  });
});

describe("课程详情工具 catalog_course_get", () => {
  it("按 jwId 返回课程详情及班级列表", async () => {
    const result = await context.client.call<GetCourseResult>(
      "catalog_course_get",
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
      "catalog_course_get",
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
      context.client.call("catalog_course_get", { jwId: 0 }),
    ).rejects.toThrow();
    await expect(
      context.client.call("catalog_course_get", { jwId: -1 }),
    ).rejects.toThrow();
    await expect(
      context.client.call("catalog_course_get", {
        jwId: "not-a-number",
      }),
    ).rejects.toThrow();
  });
});

// --- formerly mcp-15-section-match ---

describe("catalog_section_match_preview — 班级代码匹配", () => {
  it("在当前学期匹配单个班级代码", async () => {
    const result = await context.client.call<{
      success?: boolean;
      semester?: { id?: number; nameCn?: string; code?: string };
      matchedCodes?: string[];
      unmatchedCodes?: string[];
      suggestions?: Record<string, unknown>;
      sections?: Array<{ code?: string; jwId?: number }>;
      total?: number;
      note?: string;
    }>("catalog_section_match_preview", {
      codes: [fixtures.DEV_SEED.section.code],
      locale: "zh-cn",
    });

    expect(result.success).toBe(true);
    expect(result.semester?.nameCn).toBe(fixtures.DEV_SEED.semesterNameCn);
    expect(result.matchedCodes).toContain(fixtures.DEV_SEED.section.code);
    expect(result.unmatchedCodes).toEqual([]);
    expect(result.total).toBe(1);
    expect(result.sections?.[0]?.code).toBe(fixtures.DEV_SEED.section.code);
    expect(result.note).toContain("Life@USTC");
  });

  it("支持多个代码并区分匹配与未匹配，且为未匹配代码提供建议", async () => {
    const unmatchedCode = fixtures.DEV_SEED.section.code.replace(
      /\.\d+$/,
      ".02",
    );

    const result = await context.client.call<{
      success?: boolean;
      matchedCodes?: string[];
      unmatchedCodes?: string[];
      suggestions?: Record<string, string[]>;
      total?: number;
    }>("catalog_section_match_preview", {
      codes: [fixtures.DEV_SEED.section.code, unmatchedCode],
      locale: "zh-cn",
    });

    expect(result.success).toBe(true);
    expect(result.matchedCodes).toContain(fixtures.DEV_SEED.section.code);
    expect(result.matchedCodes).not.toContain(unmatchedCode);
    expect(result.unmatchedCodes).toContain(unmatchedCode);
    expect(result.total).toBe(1);
    expect(result.suggestions?.[unmatchedCode]).toContain(
      fixtures.DEV_SEED.section.code,
    );
  });

  it("可按 semesterId 查询历史学期班级代码", async () => {
    const previousSemester = await fixtures.prisma.semester.findUnique({
      where: { jwId: fixtures.DEV_SEED.previousSemesterJwId },
      select: { id: true, nameCn: true },
    });
    expect(previousSemester).toBeTruthy();

    const previousSection = fixtures.DEV_SEED.sections.find(
      (section) => section.code === "MATH2001.01",
    );
    expect(previousSection).toBeTruthy();
    if (!previousSemester || !previousSection) {
      throw new Error("Previous semester or section seed data missing");
    }

    const result = await context.client.call<{
      success?: boolean;
      semester?: { id?: number; nameCn?: string };
      matchedCodes?: string[];
      unmatchedCodes?: string[];
      total?: number;
    }>("catalog_section_match_preview", {
      codes: [previousSection.code],
      semesterId: previousSemester.id,
      locale: "zh-cn",
    });

    expect(result.success).toBe(true);
    expect(result.semester?.id).toBe(previousSemester.id);
    expect(result.semester?.nameCn).toBe(
      fixtures.DEV_SEED.previousSemesterNameCn,
    );
    expect(result.matchedCodes).toContain(previousSection.code);
    expect(result.unmatchedCodes).toEqual([]);
    expect(result.total).toBe(1);
  });

  it("在 semesterId 不存在时返回失败提示", async () => {
    const result = await context.client.call<{
      success?: boolean;
      message?: string;
    }>("catalog_section_match_preview", {
      codes: [fixtures.DEV_SEED.section.code],
      semesterId: 2_147_483_647,
      locale: "zh-cn",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("No semester found");
  });

  it("拒绝空代码数组", async () => {
    await expect(
      context.client.call("catalog_section_match_preview", {
        codes: [],
        locale: "zh-cn",
      }),
    ).rejects.toThrow();
  });

  it("拒绝非法格式班级代码", async () => {
    await expect(
      context.client.call("catalog_section_match_preview", {
        codes: ["bad code!"],
        locale: "zh-cn",
      }),
    ).rejects.toThrow();
  });
});
