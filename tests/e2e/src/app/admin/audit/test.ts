/** E2E coverage for session-only audit governance and aggregate analytics. */
import { expect, test } from "@playwright/test";
import { stringify, unflatten } from "devalue";
import {
  expectRequiresSignIn,
  signInAsDebugUser,
  signInAsDevAdmin,
} from "../../../../utils/auth";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

for (const path of [
  "/admin/audit",
  "/admin/analytics",
  "/admin/experience",
] as const) {
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
  await signInAsDevAdmin(page, "/admin/audit");
  await expect(
    page.getByRole("heading", { name: /审计日志|Audit Log/i }),
  ).toBeVisible();
  await expect(page.locator("tbody")).not.toContainText(
    /session \/ [A-Za-z0-9_-]+/,
  );
  await page
    .getByText(/更多筛选|More filters|高级筛选|Advanced filters/i, {
      exact: true,
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
  await expect(
    page.getByText(/逐用户浏览轨迹|per-user browsing trails/i),
  ).toBeVisible();
  await captureStepScreenshot(page, testInfo, "admin-analytics/window");
});

test("功能体验页面展示实际观测到的矩阵与加权指标", async ({
  page,
}, testInfo) => {
  const rows = [
    {
      authMode: "anonymous",
      errorCount: 0,
      feature: "catalog.search",
      operation: "view",
      outcome: "success",
      p50WallMs: 12.5,
      p95WallMs: 42,
      protocol: "web",
      rejectedCount: 0,
      surface: "web",
      total: 4,
      unknownCount: 0,
    },
  ];

  await signInAsDevAdmin(page, "/admin/analytics");
  await page.route("**/admin/experience/__data.json*", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    let replaced = false;
    for (const node of payload.nodes ?? []) {
      if (node?.type !== "data" || !Array.isArray(node.data)) continue;
      const data = unflatten(node.data) as Record<string, unknown>;
      if (!("rows" in data) || !("status" in data)) continue;
      node.data = JSON.parse(
        stringify({
          ...data,
          errorSamples: [],
          errorsStatus: { state: "empty" },
          rows,
          showErrors: false,
          status: { state: "ready" },
        }),
      );
      replaced = true;
    }
    expect(replaced).toBe(true);
    await route.fulfill({ response, json: payload });
  });

  await page
    .getByRole("link", { name: /查看功能体验|Open feature experience/i })
    .click();
  await expect(page).toHaveURL(/\/admin\/experience/);
  await expect(
    page.getByRole("heading", { name: /功能体验|Feature Experience/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "catalog.search", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", {
      name: /预计操作量|Estimated operations/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: /服务耗时 p50|Wall p50/i }),
  ).toBeVisible();
  await captureStepScreenshot(page, testInfo, "admin-experience/populated");
});

test("审计页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/admin/audit", testInfo });
});

test("聚合分析页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/admin/analytics", testInfo });
});

test("功能体验页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/admin/experience", testInfo });
});
