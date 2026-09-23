import { type APIRequestContext, expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../e2e/utils/dev-seed";
import { assertApiContract } from "../../_shared/api-contract";

async function getSeedSectionId(request: APIRequestContext) {
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
  return sectionId as number;
}

test("/api/catalog/sections/calendar.ics 契约", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/catalog/sections/calendar.ics",
  });
});

test("/api/catalog/sections/calendar.ics 返回日历文本", async ({ request }) => {
  const sectionId = await getSeedSectionId(request);

  const response = await request.get(
    `/api/catalog/sections/calendar.ics?sectionIds=${sectionId}`,
  );
  expect(response.status()).toBe(200);
  const content = await response.text();
  expect(content).toContain("BEGIN:VCALENDAR");
  expect(content).toContain("END:VCALENDAR");
});

test("/api/catalog/sections/calendar.ics accepts exactly 50 unique IDs", async ({
  request,
}) => {
  const sectionId = await getSeedSectionId(request);
  const unusedIds = Array.from(
    { length: 49 },
    (_, index) => 2_000_000_000 + index,
  );
  const ids = [sectionId, ...unusedIds].sort((left, right) => left - right);

  const response = await request.get(
    `/api/catalog/sections/calendar.ics?sectionIds=${ids.join(",")}`,
  );

  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("BEGIN:VCALENDAR");
});

test("/api/catalog/sections/calendar.ics rejects 51 unique IDs", async ({
  request,
}) => {
  const ids = Array.from({ length: 51 }, (_, index) => index + 1);
  const response = await request.get(
    `/api/catalog/sections/calendar.ics?sectionIds=${ids.join(",")}`,
  );

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({
    error: "sectionIds must contain at most 50 unique IDs",
  });
});

test("/api/catalog/sections/calendar.ics canonicalizes duplicate IDs", async ({
  request,
}) => {
  const response = await request.get(
    "/api/catalog/sections/calendar.ics?sectionIds=3,1,3",
    { maxRedirects: 0 },
  );

  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe(
    "http://localhost:3000/api/catalog/sections/calendar.ics?sectionIds=1%2C3",
  );
});

test("/api/catalog/sections/calendar.ics rejects malformed IDs", async ({
  request,
}) => {
  const response = await request.get(
    "/api/catalog/sections/calendar.ics?sectionIds=1,invalid,2",
  );

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({
    error: "Invalid sectionIds parameter",
  });
});
