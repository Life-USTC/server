/**
 * E2E tests for GET /api/admin/homeworks
 *
 * Admin-only endpoint listing homeworks for moderation.
 *
 * - GET returns `{ homeworks: [...] }` with section/course and user summary includes
 * - Supports `status` filter: "all", "active", "deleted"
 * - Supports `search` parameter (title, section code, course code, course name)
 * - Supports `limit` parameter (default 50, max 200)
 * - Homeworks are ordered by deletedAt desc, then createdAt desc
 * - Returns 401 for unauthenticated or non-admin requests
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser, signInAsDevAdmin } from "../../../../../utils/auth";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import { assertApiContract } from "../../../_shared/api-contract";

const BASE = "/api/admin/homeworks";

test.describe("GET /api/admin/homeworks 作业 moderation 列表", () => {
  test("API 契约", async ({ request }) => {
    await assertApiContract(request, { routePath: BASE });
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

  test("管理员可列出作业并包含关键字段", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(BASE);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      homeworks?: Array<{
        id?: string;
        title?: string;
        submissionDueAt?: string | null;
        createdAt?: string;
        updatedAt?: string;
        deletedAt?: string | null;
        section?: {
          id?: number;
          jwId?: number | null;
          code?: string | null;
          course?: { jwId?: number; code?: string; nameCn?: string };
        } | null;
        createdBy?: { id?: string; name?: string | null } | null;
        updatedBy?: unknown;
        deletedBy?: unknown;
      }>;
    };

    expect((body.homeworks?.length ?? 0) > 0).toBe(true);
    expect(
      body.homeworks?.some((item) => item.title === DEV_SEED.homeworks.title),
    ).toBe(true);

    const seedHomework = body.homeworks?.find(
      (item) => item.title === DEV_SEED.homeworks.title,
    );
    expect(seedHomework).toBeDefined();
    if (!seedHomework) return;

    expect(typeof seedHomework.id).toBe("string");
    expect(seedHomework.id).toBeTruthy();
    expect(typeof seedHomework.title).toBe("string");
    expect(
      seedHomework.submissionDueAt === null ||
        typeof seedHomework.submissionDueAt === "string",
    ).toBe(true);
    expect(typeof seedHomework.createdAt).toBe("string");
    expect(typeof seedHomework.updatedAt).toBe("string");
    expect(Object.hasOwn(seedHomework, "deletedAt")).toBe(true);
    expect(seedHomework.section).toBeDefined();
    expect(typeof seedHomework.section?.id).toBe("number");
    expect(typeof seedHomework.section?.course?.nameCn).toBe("string");
    expect(typeof seedHomework.createdBy?.id).toBe("string");
  });

  test("管理员可按 status=active 筛选未删除作业", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(`${BASE}?status=active`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      homeworks?: Array<{ title?: string; deletedAt?: string | null }>;
    };
    expect((body.homeworks?.length ?? 0) > 0).toBe(true);
    expect(
      body.homeworks?.some((item) => item.title === DEV_SEED.homeworks.title),
    ).toBe(true);
    expect(body.homeworks?.every((item) => item.deletedAt === null)).toBe(true);
  });

  test("管理员可按 search 搜索作业标题", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(
      `${BASE}?search=${encodeURIComponent(DEV_SEED.homeworks.title)}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      homeworks?: Array<{ title?: string }>;
    };
    expect((body.homeworks?.length ?? 0) > 0).toBe(true);
    expect(
      body.homeworks?.some((item) => item.title === DEV_SEED.homeworks.title),
    ).toBe(true);
  });

  test("管理员可按 search 搜索课程名称", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(
      `${BASE}?search=${encodeURIComponent(DEV_SEED.course.nameCn)}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      homeworks?: Array<{ section?: { course?: { nameCn?: string } } | null }>;
    };
    expect((body.homeworks?.length ?? 0) > 0).toBe(true);
    expect(
      body.homeworks?.some(
        (item) => item.section?.course?.nameCn === DEV_SEED.course.nameCn,
      ),
    ).toBe(true);
  });

  test("管理员可使用 limit 参数限制返回数量", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(`${BASE}?limit=1`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      homeworks?: Array<unknown>;
    };
    expect(body.homeworks?.length).toBeLessThanOrEqual(1);
  });

  test("无效 limit 参数返回 400", async ({ page }) => {
    await signInAsDevAdmin(page, "/admin");
    const response = await page.request.get(`${BASE}?limit=not-a-number`);
    expect(response.status()).toBe(400);
  });
});
