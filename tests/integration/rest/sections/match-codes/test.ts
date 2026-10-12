import { expect } from "@playwright/test";
import { DEV_SEED } from "../../../../e2e/utils/dev-seed";
import { assertApiContract } from "../../_shared/api-contract";
import { test } from "../../_shared/catalog-reader-fixture";

// Only these contracts resolve the default semester against the Worker clock.
test.beforeEach(async ({ isolatedWorker, run }) => {
  await run(async () => {
    const now = Date.now();
    await isolatedWorker.database.owner.semester.update({
      where: { jwId: DEV_SEED.semesterJwId },
      data: {
        startDate: new Date(now - 30 * 86_400_000),
        endDate: new Date(now + 180 * 86_400_000),
      },
    });
  });
});

test("/api/catalog/sections/match-codes", { tag: "@Section/REST" }, async ({
  run,
  request,
}) => {
  return run(async () => {
    await assertApiContract(request, {
      routePath: "/api/catalog/sections/match-codes",
    });
  });
});

test("/api/catalog/sections/match-codes 返回 matched 与 unmatched", {
  tag: "@Section/REST",
}, async ({ run, request }) => {
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
