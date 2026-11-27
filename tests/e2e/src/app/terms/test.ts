/**
 * E2E tests for /terms page
 *
 * Static legal page rendering the terms of service from i18n keys.
 */
import { test } from "../../../utils/public-worker";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/terms", () => {
  test("页面契约", { tag: "@Site/Web" }, async ({ page, publicFlow }) => {
    await publicFlow.run(async () => {
      await assertPageContract(page, { routePath: "/terms" });
    });
  });
});
