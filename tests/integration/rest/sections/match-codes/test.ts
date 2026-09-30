import { expect } from "@playwright/test";
import { DEV_SEED } from "../../../../e2e/utils/dev-seed";
import { assertApiContract } from "../../_shared/api-contract";
import { test } from "../../_shared/catalog-reader-fixture";

test("/api/catalog/sections/match-codes", async ({ run, request }) => {
  return run(async () => {
    await assertApiContract(request, {
      routePath: "/api/catalog/sections/match-codes",
    });
  });
});

test("/api/catalog/sections/match-codes 返回 matched 与 unmatched", async ({
  run,
  request,
}) => {
  return run(async () => {
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
});
