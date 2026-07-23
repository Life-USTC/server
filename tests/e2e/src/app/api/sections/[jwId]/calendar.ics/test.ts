import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../../../utils/dev-seed";
import { assertApiContract } from "../../../../_shared/api-contract";

test("/api/catalog/sections/[jwId]/calendar.ics 契约", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/catalog/sections/[jwId]/calendar.ics",
  });
});

test("/api/catalog/sections/[jwId]/calendar.ics 包含 seed 班级代码", async ({
  request,
}) => {
  const response = await request.get(
    `/api/catalog/sections/${DEV_SEED.section.jwId}/calendar.ics`,
  );
  expect(response.status()).toBe(200);
  const content = await response.text();
  expect(content).toContain("BEGIN:VCALENDAR");
  expect(content).toContain(DEV_SEED.section.code);
});
