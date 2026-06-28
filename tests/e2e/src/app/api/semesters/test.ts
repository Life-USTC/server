/**
 * E2E tests for GET /api/semesters
 *
 * ## Endpoints
 * - `GET /api/semesters` — List semesters with pagination, ordered by startDate descending.
 *
 * ## Request
 * - Query: `page` (optional), `limit` (optional, max 100)
 *
 * ## Response
 * - 200: `{ data: Semester[], pagination: { page, pageSize, total, totalPages } }`
 * - 400: `{ error: string }` on invalid query
 *
 * ## Auth Requirements
 * - Public (no authentication required)
 *
 * ## Edge Cases
 * - Results ordered by startDate descending (most recent first)
 * - limit param directly controls page size
 */
import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { assertApiContract } from "../../_shared/api-contract";

test.describe("GET /api/semesters", () => {
  test("契约", async ({ request }) => {
    await assertApiContract(request, { routePath: "/api/semesters" });
  });

  test("返回分页响应结构", async ({ request }) => {
    const response = await request.get("/api/semesters");
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

  test("列表包含 seed 学期", async ({ request }) => {
    const response = await request.get("/api/semesters?limit=20");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{ jwId?: number; nameCn?: string }>;
    };
    const semester = body.data?.find(
      (item) => item.jwId === DEV_SEED.semesterJwId,
    );
    expect(semester).toBeDefined();
    expect(typeof semester?.nameCn).toBe("string");
  });

  test("limit 参数控制页大小", async ({ request }) => {
    const response = await request.get("/api/semesters?limit=1");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: unknown[];
      pagination?: { pageSize?: number };
    };
    expect(body.data?.length).toBeLessThanOrEqual(1);
    expect(body.pagination?.pageSize).toBe(1);
  });

  test("学期项包含所有必需字段", async ({ request }) => {
    const response = await request.get("/api/semesters?limit=20");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{
        id?: unknown;
        jwId?: unknown;
        code?: unknown;
        nameCn?: unknown;
        startDate?: unknown;
        endDate?: unknown;
      }>;
    };
    const semester = body.data?.find(
      (item) => item.jwId === DEV_SEED.semesterJwId,
    );
    expect(semester).toBeDefined();
    expect(typeof semester?.id).toBe("number");
    expect(typeof semester?.jwId).toBe("number");
    expect(typeof semester?.code).toBe("string");
    expect(typeof semester?.nameCn).toBe("string");
    expect(typeof semester?.startDate).toBe("string");
    expect(typeof semester?.endDate).toBe("string");
  });

  test("page 参数可翻页", async ({ request }) => {
    const response = await request.get("/api/semesters?page=1");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      pagination?: { page?: number };
    };
    expect(body.pagination?.page).toBe(1);
  });
});
