/**
 * E2E tests for legacy settings content tab redirects.
 */
import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test } from "../../../../utils/settings-fixture";

test.describe.configure({ mode: "parallel" });

test.describe("/account/settings/content legacy redirect", () => {
  test("legacy ?tab=content redirects to profile", async ({ page }) => {
    for (const method of ["GET", "HEAD"] as const) {
      const response = await page.request.fetch(
        "/account/settings?tab=content&message=Success",
        { maxRedirects: 0, method },
      );

      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(
        "/account/settings/profile?message=Success",
      );
    }
  });

  test("direct /account/settings/content path returns 404", async ({
    page,
    account: _account,
  }) => {
    await gotoAndWaitForReady(page, "/account/settings/profile");
    await gotoAndWaitForReady(page, "/account/settings/content", {
      expectMainContent: false,
    });

    await expect(page.locator("h1")).toHaveText("404");
  });
});
