import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import { assertApiContract } from "../../../_shared/api-contract";

test("/api/catalog/sections/calendar.ics 契约", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/catalog/sections/calendar.ics",
  });
});

test("/api/catalog/sections/calendar.ics 返回日历文本", async ({ request }) => {
  const matchResponse = await request.post(
    "/api/catalog/sections/match-codes",
    {
      data: { codes: [DEV_SEED.section.code] },
    },
  );
  expect(matchResponse.status()).toBe(200);
  const matchBody = (await matchResponse.json()) as {
    sections?: Array<{ id?: number }>;
  };
  const sectionId = matchBody.sections?.[0]?.id;
  expect(sectionId).toBeDefined();

  const response = await request.get(
    `/api/catalog/sections/calendar.ics?sectionIds=${sectionId}`,
  );
  expect(response.status()).toBe(200);
  const content = await response.text();
  expect(content).toContain("BEGIN:VCALENDAR");
  expect(content).toContain("END:VCALENDAR");
});
