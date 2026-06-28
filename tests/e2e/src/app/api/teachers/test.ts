/**
 * E2E tests for GET /api/teachers
 *
 * ## Endpoints
 * - `GET /api/teachers` — List teachers with optional department/search filters and pagination.
 *
 * ## Request
 * - Query: `departmentId` (optional, integer), `search` (optional, matches nameCn/nameEn/code),
 *          `page` (optional), `limit` (optional)
 *
 * ## Response
 * - 200: `{ data: Teacher[], pagination: { page, pageSize, total, totalPages } }`
 *   Each teacher includes `department`, `teacherTitle`, `_count.sections`
 * - 400: `{ error: string }` on invalid query
 *
 * ## Auth Requirements
 * - Public (no authentication required)
 *
 * ## Edge Cases
 * - Non-matching search returns empty data array (not an error)
 * - Non-numeric departmentId is silently ignored (parsed via parseOptionalInt)
 * - Results ordered by nameCn ascending
 */
import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { assertApiContract } from "../../_shared/api-contract";

test.describe("GET /api/teachers", () => {
  test("契约", async ({ request }) => {
    await assertApiContract(request, { routePath: "/api/teachers" });
  });

  test("详情契约", async ({ request }) => {
    await assertApiContract(request, { routePath: "/api/teachers/[id]" });
  });

  test("返回分页响应结构", async ({ request }) => {
    const response = await request.get("/api/teachers");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: unknown[];
      pagination?: {
        page?: number;
        pageSize?: number;
        total?: number;
        totalPages?: number;
      };
    };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(typeof body.pagination?.page).toBe("number");
    expect(typeof body.pagination?.pageSize).toBe("number");
    expect(typeof body.pagination?.total).toBe("number");
    expect(typeof body.pagination?.totalPages).toBe("number");
    expect(body.pagination?.totalPages).toBeGreaterThanOrEqual(1);
  });

  test("按教师工号搜索返回 seed 教师", async ({ request }) => {
    const response = await request.get(
      `/api/teachers?search=${encodeURIComponent(DEV_SEED.teacher.code)}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{ code?: string | null; nameCn?: string }>;
    };
    const teacher = body.data?.find(
      (item) => item.code === DEV_SEED.teacher.code,
    );
    expect(teacher).toBeDefined();
    expect(teacher?.nameCn).toBe(DEV_SEED.teacher.nameCn);
  });

  test("按中文名搜索返回 seed 教师", async ({ request }) => {
    const response = await request.get(
      `/api/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{ nameCn?: string }>;
    };
    expect(
      body.data?.some((item) => item.nameCn === DEV_SEED.teacher.nameCn),
    ).toBe(true);
  });

  test("无匹配搜索返回空数据", async ({ request }) => {
    const response = await request.get(
      "/api/teachers?search=ZZZZZ_NONEXISTENT_TEACHER_99999",
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: unknown[];
      pagination?: { total?: number; totalPages?: number };
    };
    expect(body.data).toEqual([]);
    expect(body.pagination?.total).toBe(0);
    expect(body.pagination?.totalPages).toBe(1);
  });

  test("page 参数可翻页", async ({ request }) => {
    const response = await request.get("/api/teachers?page=1");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      pagination?: { page?: number };
    };
    expect(body.pagination?.page).toBe(1);
  });

  test("limit 参数控制页大小", async ({ request }) => {
    const response = await request.get("/api/teachers?limit=1");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: unknown[];
      pagination?: { pageSize?: number };
    };
    expect(body.data?.length).toBeLessThanOrEqual(1);
    expect(body.pagination?.pageSize).toBe(1);
  });

  test("详情路由返回带班级的 seed 教师", async ({ request }) => {
    const cacheBust = `teacher-detail-${Date.now()}`;
    const teacherListResponse = await request.get(
      `/api/teachers?search=${encodeURIComponent(DEV_SEED.teacher.code)}&limit=5&cacheBust=${cacheBust}`,
    );
    expect(teacherListResponse.status()).toBe(200);
    const teacherListBody = (await teacherListResponse.json()) as {
      data?: Array<{ id?: number; code?: string | null }>;
    };
    const teacherId = teacherListBody.data?.find(
      (item) => item.code === DEV_SEED.teacher.code,
    )?.id;
    expect(teacherId).toBeDefined();

    const response = await request.get(`/api/teachers/${teacherId}`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      id?: number;
      code?: string | null;
      nameCn?: string;
      nameEn?: unknown;
      telephone?: unknown;
      mobile?: unknown;
      address?: unknown;
      sections?: Array<{
        code?: string;
        course?: { nameCn?: unknown };
        semester?: unknown;
        credits?: unknown;
      }>;
      _count?: { sections?: number };
    };
    expect(body.id).toBe(teacherId);
    expect(body.code).toBe(DEV_SEED.teacher.code);
    expect(body.nameCn).toBe(DEV_SEED.teacher.nameCn);
    expect(
      body.sections?.some((section) => section.code === DEV_SEED.section.code),
    ).toBe(true);
    expect((body._count?.sections ?? 0) > 0).toBe(true);
    expect(Object.hasOwn(body, "nameEn")).toBe(true);
    expect(Object.hasOwn(body, "telephone")).toBe(true);
    expect(Object.hasOwn(body, "mobile")).toBe(true);
    expect(Object.hasOwn(body, "address")).toBe(true);
    const seedSection = body.sections?.find(
      (s) => s.code === DEV_SEED.section.code,
    );
    expect(seedSection).toBeDefined();
    expect(typeof seedSection?.course?.nameCn).toBe("string");
    expect(Object.hasOwn(seedSection as object, "semester")).toBe(true);
    expect(Object.hasOwn(seedSection as object, "credits")).toBe(true);
  });

  test("教师列表项包含所有必需的 TeacherSummary 字段", async ({ request }) => {
    const response = await request.get(
      `/api/teachers?search=${encodeURIComponent(DEV_SEED.teacher.code)}&limit=5`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{
        id?: unknown;
        nameCn?: unknown;
        code?: unknown;
        _count?: { sections?: unknown };
        department?: unknown;
        teacherTitle?: unknown;
      }>;
    };
    const teacher = body.data?.find(
      (item) => (item.code as string | null) === DEV_SEED.teacher.code,
    );
    expect(teacher).toBeDefined();
    expect(typeof teacher?.id).toBe("number");
    expect(typeof teacher?.nameCn).toBe("string");
    expect(Object.hasOwn(teacher as object, "code")).toBe(true);
    expect(typeof teacher?._count?.sections).toBe("number");
    expect((teacher?._count?.sections as number) >= 0).toBe(true);
    expect(Object.hasOwn(teacher as object, "department")).toBe(true);
    expect(Object.hasOwn(teacher as object, "teacherTitle")).toBe(true);
  });
});
