import { describe, expect, it } from "vitest";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("课程与班级查找", () => {
  it("search_courses 返回 REST 等价分页课程层级", async () => {
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
    }>("search_courses", args);

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

  it("get_section_by_jw_id 返回与 REST 班级详情相同的层级", async () => {
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
    }>("get_section_by_jw_id", {
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

  it("get_section_by_jw_id 在 jwId 缺失时返回恢复提示", async () => {
    const result = await context.client.call<{
      found?: boolean;
      message?: string;
      hint?: string;
    }>("get_section_by_jw_id", {
      jwId: 999999999,
      locale: "zh-cn",
    });

    expect(result.found).toBe(false);
    expect(result.message).toContain("999999999");
    expect(result.hint).toContain("search_sections");
  });
});

// ---------------------------------------------------------------------------
// Dashboard snapshot — compact shape verification
// ---------------------------------------------------------------------------
