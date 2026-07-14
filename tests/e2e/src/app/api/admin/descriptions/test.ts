/**
 * E2E tests for GET /api/admin/descriptions
 *
 * Admin-only endpoint listing descriptions for moderation.
 *
 * - GET returns `{ data: [...], pagination }` with detailed includes
 * - Supports `targetType` filter: "all", "section", "course", "teacher", "homework"
 * - Supports `hasContent` filter: "all", "withContent", "empty"
 * - Supports `search` parameter (content, course/section/teacher/homework names)
 * - Supports `page` and `pageSize` parameters (deprecated alias: `limit`)
 * - Descriptions are ordered by lastEditedAt desc, then updatedAt desc
 * - Returns 401 for unauthenticated or non-admin requests
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser, signInAsDevAdmin } from "../../../../../utils/auth";

const BASE = "/api/admin/descriptions";

test.describe("GET /api/admin/descriptions 课程简介管理", () => {
  test("API 契约", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(BASE);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{
        id?: string;
        content?: string;
        createdAt?: string;
        updatedAt?: string;
        lastEditedAt?: string | null;
        lastEditedById?: string | null;
        sectionId?: number | null;
        courseId?: number | null;
        teacherId?: number | null;
        homeworkId?: string | null;
        lastEditedBy?: { id?: string; name?: string | null } | null;
        section?: {
          jwId?: number | null;
          code?: string | null;
          course?: { jwId?: number; code?: string; nameCn?: string } | null;
        } | null;
        course?: { jwId?: number; code?: string; nameCn?: string } | null;
        teacher?: { id?: number; nameCn?: string } | null;
        homework?: {
          id?: string;
          title?: string;
          section?: {
            jwId?: number | null;
            code?: string | null;
            course?: { jwId?: number; code?: string; nameCn?: string } | null;
          } | null;
        } | null;
      }>;
    };

    expect((body.data?.length ?? 0) > 0).toBe(true);

    const first = body.data?.[0];
    expect(typeof first?.id).toBe("string");
    expect(typeof first?.content).toBe("string");
    expect(typeof first?.createdAt).toBe("string");
    expect(typeof first?.updatedAt).toBe("string");
    expect(Object.hasOwn(first ?? {}, "lastEditedAt")).toBe(true);
    expect(Object.hasOwn(first ?? {}, "lastEditedById")).toBe(true);
  });

  test("未认证请求返回 401", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("非管理员认证用户返回 401", async ({ page }) => {
    await signInAsDebugUser(page, "/");
    const response = await page.request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("管理员可按 targetType=section 筛选课程简介", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(`${BASE}?targetType=section`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{
        sectionId?: number | null;
        homeworkId?: string | null;
      }>;
    };
    expect((body.data?.length ?? 0) > 0).toBe(true);
    expect(body.data?.every((item) => item.sectionId !== null)).toBe(true);
    expect(body.data?.every((item) => item.homeworkId === null)).toBe(true);
  });

  test("管理员可按 hasContent=withContent 筛选非空课程简介", async ({
    page,
  }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(`${BASE}?hasContent=withContent`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{ content?: string }>;
    };
    expect((body.data?.length ?? 0) > 0).toBe(true);
    expect(
      body.data?.every((item) => item.content && item.content.length > 0),
    ).toBe(true);
  });

  test("管理员可按 hasContent=empty 筛选空课程简介", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(`${BASE}?hasContent=empty`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{ content?: string }>;
    };
    expect(body.data?.every((item) => item.content === "")).toBe(true);
  });

  test("管理员可按 search 搜索课程简介内容", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(
      `${BASE}?search=${encodeURIComponent("课程建议")}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{ content?: string; sectionId?: number | null }>;
    };
    expect((body.data?.length ?? 0) > 0).toBe(true);
    expect(body.data?.some((item) => item.content?.includes("课程建议"))).toBe(
      true,
    );
  });

  test("管理员可使用 pageSize 参数限制返回数量", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const firstResponse = await page.request.get(`${BASE}?pageSize=1`);
    const secondResponse = await page.request.get(`${BASE}?page=2&pageSize=1`);
    expect(firstResponse.status()).toBe(200);
    expect(secondResponse.status()).toBe(200);
    const first = (await firstResponse.json()) as {
      data?: Array<{ id?: string }>;
      pagination?: { total?: number };
    };
    const second = (await secondResponse.json()) as {
      data?: Array<{ id?: string }>;
      pagination?: { page?: number; pageSize?: number; total?: number };
    };
    expect((first.pagination?.total ?? 0) > 1).toBe(true);
    expect(first.data).toHaveLength(1);
    expect(second.pagination).toMatchObject({
      page: 2,
      pageSize: 1,
      total: first.pagination?.total,
    });
    expect(second.data?.[0]?.id).not.toBe(first.data?.[0]?.id);
  });

  test("无效 limit 参数返回 400", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(`${BASE}?limit=not-a-number`);
    expect(response.status()).toBe(400);
  });
});
