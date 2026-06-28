/**
 * E2E tests for /api/docs
 */
import { expect, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { assertPageContract } from "../../_shared/page-contract";

test.describe("/api/docs 页面", () => {
  test("接口契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/api/docs/tag/sections",
      testInfo,
    });
  });

  test("渲染 API 参考容器", async ({ page }) => {
    await gotoAndWaitForReady(page, "/api/docs/tag/sections", {
      waitUntil: "load",
    });
    await expect(page.locator("#api-reference")).toBeVisible();
  });

  test("使用路径导航而非哈希导航", async ({ page }) => {
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

  test("根路径重定向到第一个路由分组", async ({ page }) => {
    await page.goto("/api/docs");
    await expect(page).toHaveURL(/\/api\/docs\/tag\/sections$/);
  });
});

test.describe("/api-docs 页面", () => {
  test("重定向到 /api/docs", async ({ page }) => {
    await page.goto("/api-docs");
    await expect(page).toHaveURL(/\/api\/docs\/tag\/sections$/);
  });
});
