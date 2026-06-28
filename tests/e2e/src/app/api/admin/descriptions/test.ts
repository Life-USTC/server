/**
 * E2E tests for GET /api/admin/descriptions
 *
 * Admin-only endpoint listing descriptions for moderation.
 *
 * - GET returns `{ descriptions: [...] }` with detailed includes
 * - Supports `targetType` filter: "all", "section", "course", "teacher", "homework"
 * - Supports `hasContent` filter: "all", "withContent", "empty"
 * - Supports `search` parameter (content, course/section/teacher/homework names)
 * - Supports `limit` parameter (default 50, max 200)
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
      descriptions?: Array<{
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

    expect((body.descriptions?.length ?? 0) > 0).toBe(true);

    const first = body.descriptions?.[0];
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
      descriptions?: Array<{
        sectionId?: number | null;
        homeworkId?: string | null;
      }>;
    };
    expect((body.descriptions?.length ?? 0) > 0).toBe(true);
    expect(body.descriptions?.every((item) => item.sectionId !== null)).toBe(
      true,
    );
    expect(body.descriptions?.every((item) => item.homeworkId === null)).toBe(
      true,
    );
  });

  test("管理员可按 hasContent=withContent 筛选非空课程简介", async ({
    page,
  }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(`${BASE}?hasContent=withContent`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      descriptions?: Array<{ content?: string }>;
    };
    expect((body.descriptions?.length ?? 0) > 0).toBe(true);
    expect(
      body.descriptions?.every(
        (item) => item.content && item.content.length > 0,
      ),
    ).toBe(true);
  });

  test("管理员可按 hasContent=empty 筛选空课程简介", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(`${BASE}?hasContent=empty`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      descriptions?: Array<{ content?: string }>;
    };
    expect(body.descriptions?.every((item) => item.content === "")).toBe(true);
  });

  test("管理员可按 search 搜索课程简介内容", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(
      `${BASE}?search=${encodeURIComponent("课程建议")}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      descriptions?: Array<{ content?: string; sectionId?: number | null }>;
    };
    expect((body.descriptions?.length ?? 0) > 0).toBe(true);
    expect(
      body.descriptions?.some((item) => item.content?.includes("课程建议")),
    ).toBe(true);
  });

  test("管理员可使用 limit 参数限制返回数量", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(`${BASE}?limit=1`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      descriptions?: Array<unknown>;
    };
    expect(body.descriptions?.length).toBeLessThanOrEqual(1);
  });

  test("无效 limit 参数返回 400", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(`${BASE}?limit=not-a-number`);
    expect(response.status()).toBe(400);
  });
});
