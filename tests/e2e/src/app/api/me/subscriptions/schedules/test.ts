/**
 * E2E tests for GET /api/workspace/schedules
 *
 * Authenticated one-call schedule query across the current user's subscribed
 * sections. This replaces client-side fan-out over /api/catalog/schedules.
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../../utils/auth";
import { DEV_SEED } from "../../../../../../utils/dev-seed";
import { assertApiContract } from "../../../../_shared/api-contract";

const BASE = "/api/workspace/schedules";

test.describe("GET /api/workspace/schedules - 订阅课表", () => {
  test("契约", async ({ request }) => {
    await assertApiContract(request, { routePath: BASE });
  });

  test("未认证时返回 401", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("一次认证响应返回已订阅课表", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.get(
      `${BASE}?dateFrom=${DEV_SEED.seedAnchorAtTime.slice(0, 10)}&dateTo=${DEV_SEED.seedAnchorAtTime.slice(0, 10)}&limit=5`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      schedules?: Array<{
        date?: string | null;
        section?: { code?: string; course?: { nameCn?: string } };
        startTime?: string;
        endTime?: string;
      }>;
    };

    expect((body.schedules?.length ?? 0) > 0).toBe(true);
    const seedSchedule = body.schedules?.find(
      (schedule) => schedule.section?.code === DEV_SEED.section.code,
    );
    expect(seedSchedule).toBeDefined();
    expect(
      seedSchedule?.date?.startsWith(DEV_SEED.seedAnchorAtTime.slice(0, 10)),
    ).toBe(true);
    expect(seedSchedule?.section?.course?.nameCn).toBe(DEV_SEED.course.nameCn);
    expect(seedSchedule?.startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(seedSchedule?.endTime).toMatch(/^\d{2}:\d{2}$/);
  });

  test("无效日期查询返回 400", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.get(`${BASE}?dateFrom=not-a-date`);
    expect(response.status()).toBe(400);
  });
});
