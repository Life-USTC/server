/**
 * E2E tests for GET /api/me/subscriptions/schedules
 *
 * Authenticated one-call schedule query across the current user's subscribed
 * sections. This replaces client-side fan-out over /api/schedules.
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../../utils/auth";
import { DEV_SEED } from "../../../../../../utils/dev-seed";
import { assertApiContract } from "../../../../_shared/api-contract";

const BASE = "/api/me/subscriptions/schedules";

test.describe("GET /api/me/subscriptions/schedules", () => {
  test("contract", async ({ request }) => {
    await assertApiContract(request, { routePath: BASE });
  });

  test("returns 401 when not authenticated", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("returns subscribed schedules in one authenticated response", async ({
    page,
  }) => {
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

  test("invalid date query returns 400", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.get(`${BASE}?dateFrom=not-a-date`);
    expect(response.status()).toBe(400);
  });
});
