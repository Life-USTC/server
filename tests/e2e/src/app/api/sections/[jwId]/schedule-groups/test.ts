import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../../../utils/dev-seed";
import { assertApiContract } from "../../../../_shared/api-contract";

test("/api/sections/[jwId]/schedule-groups 契约", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/sections/[jwId]/schedule-groups",
  });
});

test("/api/sections/[jwId]/schedule-groups 返回默认组及课表", async ({
  request,
}) => {
  const response = await request.get(
    `/api/sections/${DEV_SEED.section.jwId}/schedule-groups`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as Array<{ schedules?: unknown[] }>;
  expect(body.length).toBeGreaterThan(0);
  expect(body.some((item) => (item.schedules?.length ?? 0) > 0)).toBe(true);
});
