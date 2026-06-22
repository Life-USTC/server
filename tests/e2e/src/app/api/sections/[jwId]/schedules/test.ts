import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../../../utils/dev-seed";
import { assertApiContract } from "../../../../_shared/api-contract";

test("/api/sections/[jwId]/schedules", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/sections/[jwId]/schedules",
  });
});

test("/api/sections/[jwId]/schedules 返回排课明细", async ({ request }) => {
  const response = await request.get(
    `/api/sections/${DEV_SEED.section.jwId}/schedules`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as Array<{
    scheduleGroup?: { id?: number };
    teachers?: Array<{ nameCn?: string }>;
  }>;
  expect(body.length).toBeGreaterThan(0);
  expect(body.some((item) => Boolean(item.scheduleGroup?.id))).toBe(true);
  expect(
    body.some((item) =>
      item.teachers?.some(
        (teacher) => teacher.nameCn === DEV_SEED.teacher.nameCn,
      ),
    ),
  ).toBe(true);
});

test("/api/sections/[jwId]/schedules 支持日期窗口", async ({ request }) => {
  const seedDate = DEV_SEED.seedAnchorAtTime.slice(0, 10);
  const response = await request.get(
    `/api/sections/${DEV_SEED.section.jwId}/schedules?dateFrom=${seedDate}&dateTo=${seedDate}&limit=5`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as Array<{ date?: string }>;
  expect(body.length).toBeGreaterThan(0);
  expect(body.length).toBeLessThanOrEqual(5);
  expect(body.every((item) => item.date?.startsWith(seedDate))).toBe(true);
});

test("/api/sections/[jwId]/schedules 支持 limit", async ({ request }) => {
  const response = await request.get(
    `/api/sections/${DEV_SEED.section.jwId}/schedules?limit=1`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as Array<unknown>;
  expect(body.length).toBeLessThanOrEqual(1);
});

test("/api/sections/[jwId]/schedules 无效日期返回 400", async ({ request }) => {
  const response = await request.get(
    `/api/sections/${DEV_SEED.section.jwId}/schedules?dateFrom=not-a-date`,
  );
  expect(response.status()).toBe(400);
});

test("/api/sections/[jwId]/schedules 无效 limit 返回 400", async ({
  request,
}) => {
  for (const limit of [0, 201]) {
    const response = await request.get(
      `/api/sections/${DEV_SEED.section.jwId}/schedules?limit=${limit}`,
    );
    expect(response.status()).toBe(400);
  }
});
