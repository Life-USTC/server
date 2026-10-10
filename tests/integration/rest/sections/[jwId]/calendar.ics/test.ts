import { expect } from "@playwright/test";
import { DEV_SEED } from "../../../../../e2e/utils/dev-seed";
import { assertApiContract } from "../../../_shared/api-contract";
import { test } from "../../../_shared/catalog-reader-fixture";

test("/api/catalog/sections/[jwId]/calendar.ics 契约", {
  tag: "@Calendar/ICS",
}, async ({ run, request }) => {
  return run(async () => {
    await assertApiContract(request, {
      routePath: "/api/catalog/sections/[jwId]/calendar.ics",
    });
  });
});

test("/api/catalog/sections/[jwId]/calendar.ics 包含 seed 班级代码", {
  tag: "@Calendar/ICS",
}, async ({ run, request }) => {
  return run(async () => {
    const response = await request.get(
      `/api/catalog/sections/${DEV_SEED.section.jwId}/calendar.ics`,
    );
    expect(response.status()).toBe(200);
    const content = await response.text();
    expect(content).toContain("BEGIN:VCALENDAR");
    expect(content).toContain(DEV_SEED.section.code);
  });
});
