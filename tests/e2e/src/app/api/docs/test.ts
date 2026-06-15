/**
 * E2E tests for /api/docs
 */
import { expect, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { assertPageContract } from "../../_shared/page-contract";

test.describe("/api/docs", () => {
  test("contract", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/api/docs/tag/sections",
      testInfo,
    });
  });

  test("renders API reference container", async ({ page }) => {
    await gotoAndWaitForReady(page, "/api/docs/tag/sections", {
      waitUntil: "load",
    });
    await expect(page.locator("#api-reference")).toBeVisible();
  });

  test("uses path navigation instead of hash navigation", async ({ page }) => {
    await gotoAndWaitForReady(page, "/api/docs/tag/sections", {
      waitUntil: "load",
    });
    await page
      .getByRole("link", { name: "GET List sections", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/api\/docs\/tag\/sections\/GET\/api\/sections$/,
    );
  });

  test("redirects root to first route group", async ({ page }) => {
    await page.goto("/api/docs");
    await expect(page).toHaveURL(/\/api\/docs\/tag\/sections$/);
  });
});

test.describe("/api-docs", () => {
  test("redirects to /api/docs", async ({ page }) => {
    await page.goto("/api-docs");
    await expect(page).toHaveURL(/\/api\/docs\/tag\/sections$/);
  });
});
