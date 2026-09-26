import { expect, test } from "@playwright/test";
import { subscribedExamsResponseSchema } from "@/lib/api/schemas/subscribed-exams-schemas";
import { signInAsDebugUserApi } from "../../_harness/auth";

const BASE = "/api/workspace/exams";
test("requires authentication", async ({ request }) => {
  expect((await request.get(BASE)).status()).toBe(401);
});
test("returns private paginated exam records with section and semester context", async ({
  request,
}) => {
  await signInAsDebugUserApi(request);
  const response = await request.get(`${BASE}?pageSize=1`);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("private");
  const result = subscribedExamsResponseSchema.parse(await response.json());
  expect(result.pagination.pageSize).toBe(1);
  expect(result.pagination.total).toBeGreaterThan(0);
  expect(result.data).toHaveLength(1);
  expect(result.data[0].section.semester?.nameCn).toBeTruthy();
});
test("rejects invalid dates, reversed ranges and invalid pagination", async ({
  request,
}) => {
  await signInAsDebugUserApi(request);
  for (const query of [
    "dateFrom=invalid",
    "dateFrom=2026-09-16&dateTo=2026-09-15",
    "pageSize=101",
    "includeDateUnknown=invalid",
  ]) {
    expect((await request.get(`${BASE}?${query}`)).status()).toBe(400);
  }
});
