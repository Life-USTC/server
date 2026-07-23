/**
 * E2E tests for GET /api/catalog/semesters/current
 *
 * ## Endpoints
 * - `GET /api/catalog/semesters/current` — Get the current semester (date range contains now).
 *
 * ## Request
 * - No query params
 *
 * ## Response
 * - 200: Semester object `{ jwId, nameCn, code, startDate, endDate, ... }`
 * - 404: `{ error: "No current semester found" }` when no semester covers today
 *
 * ## Auth Requirements
 * - Public (no authentication required)
 *
 * ## Edge Cases
 * - Time-sensitive: relies on seed semester date range covering the current date
 * - Returns a single semester object (not paginated)
 */
import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import { assertApiContract } from "../../../_shared/api-contract";

test.describe("GET /api/catalog/semesters/current", () => {
  test("契约", async ({ request }) => {
    await assertApiContract(request, {
      routePath: "/api/catalog/semesters/current",
    });
  });

  test("返回 seed 学期", async ({ request }) => {
    const response = await request.get("/api/catalog/semesters/current");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      jwId?: number;
      nameCn?: string;
      code?: string;
    };
    expect(body.jwId).toBe(DEV_SEED.semesterJwId);
    expect(typeof body.nameCn).toBe("string");
  });

  test("响应包含预期字段", async ({ request }) => {
    const response = await request.get("/api/catalog/semesters/current");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("jwId");
    expect(body).toHaveProperty("nameCn");
    expect(body).toHaveProperty("startDate");
    expect(body).toHaveProperty("endDate");
  });
});
