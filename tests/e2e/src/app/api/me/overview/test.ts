/**
 * E2E tests for GET /api/me/overview
 *
 * Authenticated compact overview for lightweight clients. The response combines
 * schedule, todo, homework, and exam samples without client-side fan-out.
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../../utils/auth";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import { assertApiContract } from "../../../_shared/api-contract";

const BASE = "/api/me/overview";

test.describe("GET /api/me/overview", () => {
  test("contract", async ({ request }) => {
    await assertApiContract(request, { routePath: BASE });
  });

  test("returns 401 when not authenticated", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("returns compact counts and top items", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.get(
      `${BASE}?atTime=${encodeURIComponent(DEV_SEED.seedAnchorAtTime)}&homeworkWindowDays=7&limit=3`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      anchor?: { homeworkWindowDays?: number; limit?: number };
      counts?: {
        todos?: { incomplete?: number; overdue?: number };
        pendingHomeworks?: number;
        dueSoonHomeworks?: number;
        todaySchedules?: number;
        upcomingExams?: number;
      };
      schedules?: {
        total?: number;
        items?: Array<{ section?: { code?: string } }>;
      };
      todos?: { items?: Array<{ title?: string }> };
      homeworks?: { items?: Array<{ title?: string }> };
      exams?: { items?: Array<{ section?: { code?: string } }> };
      user?: { userId?: string; name?: string | null };
    };

    expect(body.user?.name).toBe(DEV_SEED.debugName);
    expect(body.anchor?.homeworkWindowDays).toBe(7);
    expect(body.anchor?.limit).toBe(3);
    expect((body.counts?.todos?.incomplete ?? 0) > 0).toBe(true);
    expect((body.counts?.pendingHomeworks ?? 0) > 0).toBe(true);
    expect((body.counts?.todaySchedules ?? 0) > 0).toBe(true);
    expect((body.counts?.upcomingExams ?? 0) > 0).toBe(true);
    expect(
      body.schedules?.items?.some(
        (schedule) => schedule.section?.code === DEV_SEED.section.code,
      ),
    ).toBe(true);
    expect(
      body.todos?.items?.some(
        (todo) => todo.title === DEV_SEED.todos.dueTodayTitle,
      ),
    ).toBe(true);
    expect((body.homeworks?.items?.length ?? 0) > 0).toBe(true);
    expect((body.exams?.items?.length ?? 0) > 0).toBe(true);
  });

  test("invalid atTime returns 400", async ({ page }) => {
    await signInAsDebugUser(page, "/");

    const response = await page.request.get(`${BASE}?atTime=not-a-date`);
    expect(response.status()).toBe(400);
  });
});
