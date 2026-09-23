/**
 * E2E tests for GET /api/workspace/homeworks
 *
 * Authenticated endpoint that lists homeworks across the current user's
 * subscribed sections through a bounded page.
 *
 * - GET returns { data[], pagination }
 * - Requires authentication (401 otherwise)
 * - page is capped at 100 and pageSize is capped at 50
 */
import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../../e2e/utils/dev-seed";
import { ensureSeedSectionSubscription } from "../../../../../e2e/utils/subscriptions";
import { signInAsDebugUserApi } from "../../../_harness/auth";

const BASE = "/api/workspace/homeworks";

test.describe("GET /api/workspace/homeworks - 订阅作业", () => {
  test("契约探测返回 401", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("未认证时返回 401", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("认证并关注种子班级后返回分页订阅作业", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");
    await ensureSeedSectionSubscription(request);

    const response = await request.get(BASE);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{
        id?: string;
        title?: string;
        sectionId?: number;
        section?: { code?: string; course?: { nameCn?: string } };
        completion?: unknown;
      }>;
      pagination?: {
        page?: number;
        pageSize?: number;
        total?: number;
        totalPages?: number;
      };
    };

    expect(Array.isArray(body.data)).toBe(true);
    expect(
      body.data?.some((item) => item.title === DEV_SEED.homeworks.title),
    ).toBe(true);

    const seedHomework = body.data?.find(
      (item) => item.title === DEV_SEED.homeworks.title,
    );
    expect(seedHomework).toBeDefined();
    if (seedHomework) {
      expect(typeof seedHomework.id).toBe("string");
      expect(typeof seedHomework.sectionId).toBe("number");
      expect(seedHomework.section?.code).toBe(DEV_SEED.section.code);
      expect(seedHomework.section?.course?.nameCn).toBe(DEV_SEED.course.nameCn);
      expect(Object.hasOwn(seedHomework, "completion")).toBe(true);
    }

    expect(body.pagination).toMatchObject({ page: 1, pageSize: 20 });
    expect(typeof body.pagination?.total).toBe("number");
  });

  test("拒绝越界分页参数", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");

    expect((await request.get(`${BASE}?page=101`)).status()).toBe(400);
    expect((await request.get(`${BASE}?pageSize=51`)).status()).toBe(400);
  });
});
