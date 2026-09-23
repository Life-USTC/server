/**
 * E2E tests for GET /api/workspace/schedules
 *
 * Authenticated one-call schedule query across the current user's subscribed
 * sections. This replaces client-side fan-out over /api/catalog/schedules.
 */
import { expect, test } from "@playwright/test";
import { subscribedSchedulesResponseSchema } from "@/lib/api/schemas/schedule-response-schema-core";
import { DEV_SEED } from "../../../../../e2e/utils/dev-seed";
import { signInAsDebugUserApi } from "../../../_harness/auth";
import { assertApiContract } from "../../../_shared/api-contract";

const BASE = "/api/workspace/schedules";

test.describe("GET /api/workspace/schedules - 订阅课表", () => {
  test("契约", async ({ request }) => {
    await assertApiContract(request, { routePath: BASE });
  });

  test("未认证时返回 401", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(401);
  });

  test("一次认证响应返回已订阅课表", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");

    const response = await request.get(
      `${BASE}?dateFrom=${DEV_SEED.seedAnchorAtTime.slice(0, 10)}&dateTo=${DEV_SEED.seedAnchorAtTime.slice(0, 10)}&limit=5`,
    );
    expect(response.status()).toBe(200);
    const body = subscribedSchedulesResponseSchema.parse(await response.json());

    expect(body.schedules.length).toBeGreaterThan(0);
    const seedSchedule = body.schedules.find(
      (schedule) => schedule.section.code === DEV_SEED.section.code,
    );
    expect(seedSchedule).toBeDefined();
    expect(
      seedSchedule?.date?.startsWith(DEV_SEED.seedAnchorAtTime.slice(0, 10)),
    ).toBe(true);
    expect(seedSchedule?.section.course.nameCn).toBe(DEV_SEED.course.nameCn);
    expect(seedSchedule?.startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(seedSchedule?.endTime).toMatch(/^\d{2}:\d{2}$/);

    const seedTeacher = seedSchedule?.teachers.find(
      (teacher) => teacher.jwId === DEV_SEED.teacher.jwId,
    );
    expect(seedTeacher?.namePrimary).toBe(DEV_SEED.teacher.nameCn);
    expect(seedTeacher?.nameSecondary).toBe(DEV_SEED.teacher.nameEn);
    expect(seedTeacher?.department?.namePrimary).toBe(
      DEV_SEED.teacher.departmentNameCn,
    );
    expect(seedTeacher?.teacherTitle?.namePrimary).toBe(
      DEV_SEED.teacher.titleNameCn,
    );
    expect(seedTeacher?._count.sections).toBeGreaterThan(0);
  });

  test("无效日期查询返回 400", async ({ request }) => {
    await signInAsDebugUserApi(request, "/");

    const response = await request.get(`${BASE}?dateFrom=not-a-date`);
    expect(response.status()).toBe(400);
  });
});
