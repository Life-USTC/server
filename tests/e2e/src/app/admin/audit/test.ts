/** E2E coverage for session-only audit governance and aggregate analytics. */
import { expect, test } from "@playwright/test";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../../utils/auth";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

for (const path of ["/admin/audit", "/admin/analytics"] as const) {
  test(`${path} 未登录重定向到登录页`, async ({ page }) => {
    await expectRequiresSignIn(page, path);
  });

  test(`${path} 普通用户访问返回 403`, async ({ page }) => {
    await signInAsDebugUser(page, path, path);
    await expect(page.getByText("403").first()).toBeVisible();
  });
}

test("/admin/audit 支持安全字段筛选且不显示网络或会话字段", async ({
  page,
}, testInfo) => {
  await signInAsDevAdmin(page, "/admin/audit?admin_tab=audit");
  await expect(
    page.getByRole("heading", {
      name: /操作与异常日志|Operations and Issues/i,
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: /记录|Records/i, exact: true })
      .locator("tbody"),
  ).not.toContainText(/session \/ [A-Za-z0-9_-]+/);
  await page
    .getByRole("button", {
      name: /更多筛选|More filters|高级筛选|Advanced filters/i,
    })
    .click();
  await page.getByLabel(/操作人 ID|Actor ID/i).fill("e2e-user-admin");
  await page.getByRole("button", { name: /应用筛选|Apply filters/i }).click();
  await expect(page).toHaveURL(/actor=e2e-user-admin/);
  await expect(page.getByText(/sessionId|requestId|oauthGrantId/i)).toHaveCount(
    0,
  );
  await captureStepScreenshot(page, testInfo, "admin-audit/filters");
});

test("/admin/analytics 只展示聚合维度并支持统计周期", async ({
  page,
}, testInfo) => {
  await signInAsDevAdmin(page, "/admin/analytics");
  await page.getByRole("link", { name: /最近 7 天|Last 7 days/i }).click();
  await expect(page).toHaveURL(/days=7/);
  await expect(page.locator("#telemetry-operations-title")).toBeVisible();
  await expect(
    page.getByRole("tab", { name: /功能使用|Features/i }),
  ).toHaveAttribute("aria-selected", "true");
  await captureStepScreenshot(page, testInfo, "admin-analytics/window");
});

test("审计页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/admin/audit", testInfo });
});
