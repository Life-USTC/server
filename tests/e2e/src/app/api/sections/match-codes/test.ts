import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import { assertApiContract } from "../../../_shared/api-contract";

test("/api/catalog/sections/match-codes", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/catalog/sections/match-codes",
  });
});

test("/api/catalog/sections/match-codes 返回 matched 与 unmatched", async ({
  request,
}) => {
  const unknownCode = "ZZ9999.99";
  const response = await request.post("/api/catalog/sections/match-codes", {
    data: { codes: [DEV_SEED.section.code, unknownCode] },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    matchedCodes?: string[];
    unmatchedCodes?: string[];
  };
  expect(body.matchedCodes).toContain(DEV_SEED.section.code);
  expect(body.unmatchedCodes).toContain(unknownCode);
});
