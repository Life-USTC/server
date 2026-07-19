/**
 * E2E tests for GET /api/courses
 *
 * ## Endpoints
 * - `GET /api/courses` — List courses with optional search and pagination.
 *
 * ## Request
 * - Query: `locale` (optional, en-us/zh-cn), `search` (optional, matches
 *          nameCn/nameEn/code, case-insensitive), `page` (optional, default 1),
 *          `pageSize` (optional), and deprecated `limit` alias
 *
 * ## Response
 * - 200: `{ data: Course[], pagination: { page, pageSize, total, totalPages } }`
 * - 400: `{ error: string }` on invalid query
 *
 * ## Auth Requirements
 * - Public (no authentication required)
 *
 * ## Edge Cases
 * - Non-matching search returns empty data array (not an error)
 * - totalPages is always >= 1, even when total is 0
 * - Search is case-insensitive across nameCn, nameEn, and code fields
 */
import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { assertApiContract } from "../../_shared/api-contract";

test.describe("GET /api/courses 接口", () => {
  test("接口契约", async ({ request }) => {
    await assertApiContract(request, { routePath: "/api/courses" });
  });

  test("详情接口契约", async ({ request }) => {
    await assertApiContract(request, { routePath: "/api/courses/[jwId]" });
  });

  test("返回分页响应结构", async ({ request }) => {
    const response = await request.get("/api/courses");
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

  test("仅显式 locale URL 变体使用共享缓存", async ({ request }) => {
    const explicit = await request.get("/api/courses?locale=en-us&pageSize=1", {
      headers: {
        "accept-language": "zh-CN",
        cookie: "NEXT_LOCALE=zh-cn",
      },
    });
    expect(explicit.status()).toBe(200);
    expect(explicit.headers()["cache-control"]).toBe(
      "public, max-age=0, must-revalidate",
    );
    expect(explicit.headers()["cloudflare-cdn-cache-control"]).toBe(
      "public, max-age=60, stale-while-revalidate=300",
    );

    const fallback = await request.get("/api/courses?pageSize=1", {
      headers: { "accept-language": "en-US" },
    });
    expect(fallback.status()).toBe(200);
    expect(fallback.headers()["cache-control"]).toBe("private, no-store");
    expect(fallback.headers()["cloudflare-cdn-cache-control"]).toBe("no-store");

    const invalid = await request.get("/api/courses?locale=fr-fr");
    expect(invalid.status()).toBe(400);
    expect(invalid.headers()["cache-control"]).toBe("private, no-store");
    expect(invalid.headers()["cloudflare-cdn-cache-control"]).toBe("no-store");
  });

  test("按课程代码搜索返回 seed 课程", async ({ request }) => {
    const response = await request.get(
      `/api/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{ jwId?: number; code?: string; nameCn?: string }>;
    };
    const course = body.data?.find(
      (item) => item.jwId === DEV_SEED.course.jwId,
    );
    expect(course).toBeDefined();
    expect(course?.code).toBe(DEV_SEED.course.code);
    expect(course?.nameCn).toBe(DEV_SEED.course.nameCn);
  });

  test("按中文名搜索返回 seed 课程", async ({ request }) => {
    const response = await request.get(
      `/api/courses?search=${encodeURIComponent(DEV_SEED.course.nameCn)}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{ jwId?: number; nameCn?: string }>;
    };
    expect(body.data?.some((item) => item.jwId === DEV_SEED.course.jwId)).toBe(
      true,
    );
  });

  test("无匹配搜索返回空数据", async ({ request }) => {
    const response = await request.get(
      "/api/courses?search=ZZZZZ_NONEXISTENT_COURSE_99999",
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

  test("课程列表项包含所有必填字段", async ({ request }) => {
    const response = await request.get(
      `/api/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{
        id?: unknown;
        jwId?: unknown;
        code?: unknown;
        nameCn?: unknown;
        nameEn?: unknown;
        educationLevel?: unknown;
        category?: unknown;
        classType?: unknown;
      }>;
    };
    const course = body.data?.find(
      (item) => item.jwId === DEV_SEED.course.jwId,
    );
    expect(course).toBeDefined();
    expect(typeof course?.id).toBe("number");
    expect(typeof course?.jwId).toBe("number");
    expect(typeof course?.code).toBe("string");
    expect(typeof course?.nameCn).toBe("string");
    expect(typeof course?.nameEn).toBe("string");
    expect(Object.hasOwn(course as object, "educationLevel")).toBe(true);
    expect(Object.hasOwn(course as object, "category")).toBe(true);
    expect(Object.hasOwn(course as object, "classType")).toBe(true);
  });

  test("page 参数切换结果页", async ({ request }) => {
    const response = await request.get("/api/courses?page=1");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      pagination?: { page?: number };
    };
    expect(body.pagination?.page).toBe(1);
  });

  test("pageSize 控制分页大小并优先于 limit 别名", async ({ request }) => {
    const response = await request.get("/api/courses?pageSize=1&limit=2");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: unknown[];
      pagination?: { pageSize?: number };
    };
    expect(body.data?.length).toBeLessThanOrEqual(1);
    expect(body.pagination?.pageSize).toBe(1);
  });

  test("详情路由返回 seed 课程及其开课班", async ({ request }) => {
    const response = await request.get(`/api/courses/${DEV_SEED.course.jwId}`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      jwId?: number;
      code?: string;
      nameCn?: string;
      sections?: Array<{
        jwId?: number;
        code?: string;
        semester?: { nameCn?: string } | null;
        campus?: { nameCn?: string } | null;
        teachers?: unknown[];
        stdCount?: unknown;
        limitCount?: unknown;
      }>;
    };
    expect(body.jwId).toBe(DEV_SEED.course.jwId);
    expect(body.code).toBe(DEV_SEED.course.code);
    expect(body.nameCn).toBe(DEV_SEED.course.nameCn);
    expect(
      body.sections?.some((section) => section.jwId === DEV_SEED.section.jwId),
    ).toBe(true);
    const seedSection = body.sections?.find(
      (s) => s.jwId === DEV_SEED.section.jwId,
    );
    expect(seedSection).toBeDefined();
    expect(Object.hasOwn(seedSection as object, "semester")).toBe(true);
    expect(Object.hasOwn(seedSection as object, "campus")).toBe(true);
    expect(Array.isArray(seedSection?.teachers)).toBe(true);
    expect(typeof seedSection?.stdCount).toBe("number");
    expect(typeof seedSection?.limitCount).toBe("number");
  });

  test("旧 jwId 别名返回 canonical 课程", async ({ request }) => {
    const response = await request.get(
      `/api/courses/${DEV_SEED.course.legacyJwId}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      jwId?: number;
      code?: string;
    };
    expect(body).toMatchObject({
      jwId: DEV_SEED.course.jwId,
      code: DEV_SEED.course.code,
    });
  });
});
