import { expect, type Page, test } from "@playwright/test";
import { stringify, unflatten } from "devalue";
import { signInAsDevAdmin } from "../../../../utils/auth";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

const readyRow = {
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
};
const sample = {
  authMode: "unknown",
  errorClass: "unknown",
  feature: "workspace.homework",
  occurredAt: "2026-09-14T01:23:45Z",
  operation: "list",
  outcome: "unknown",
  protocol: "mcp",
  requestId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  surface: "unknown",
};

async function fixture(
  page: Page,
  path: "analytics" | "audit",
  patch: Record<string, unknown>,
) {
  await page.route(`**/admin/${path}/__data.json*`, async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    const key = path === "analytics" ? "telemetry" : "issues";
    let replaced = false;
    for (const node of payload.nodes ?? []) {
      if (node?.type !== "data" || !Array.isArray(node.data)) continue;
      const data = unflatten(node.data) as Record<string, unknown>;
      if (!(key in data)) continue;
      node.data = JSON.parse(
        stringify({
          ...data,
          [key]: { ...(data[key] as Record<string, unknown>), ...patch },
        }),
      );
      replaced = true;
    }
    expect(replaced).toBe(true);
    await route.fulfill({ response, json: payload });
  });
}
async function openStatistics(page: Page, patch: Record<string, unknown>) {
  await signInAsDevAdmin(page, "/admin/audit");
  await fixture(page, "analytics", patch);
  await page
    .getByRole("link", { name: /统计数据|Usage Statistics/i, exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/analytics$/);
}

test("统计页合并趋势与功能矩阵，周期切换保留筛选", async ({
  page,
}, testInfo) => {
  await openStatistics(page, { rows: [readyRow], status: { state: "ready" } });
  await expect(
    page.getByRole("heading", {
      name: /统计数据|Usage Statistics/i,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: /服务耗时 p50|Wall p50/i }),
  ).toBeVisible();
  await page.locator("#experience-feature").selectOption("catalog.search");
  await page.locator("#experience-protocol").selectOption("web");
  await page
    .getByRole("button", { name: /应用筛选|Apply filters/i, exact: true })
    .click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("feature") === "catalog.search" &&
      url.searchParams.get("protocol") === "web",
  );
  await page
    .getByRole("link", { name: /最近 7 天|Last 7 days/i, exact: true })
    .click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("days") === "7" &&
      url.searchParams.get("feature") === "catalog.search" &&
      url.searchParams.get("protocol") === "web",
  );
  await page
    .getByRole("heading", { name: /功能.*矩阵|Feature.*matrix/i })
    .scrollIntoViewIfNeeded();
  await captureStepScreenshot(page, testInfo, "admin-statistics/matrix");
  await page
    .getByRole("link", { name: /^清除$|^Clear$/i, exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/analytics$/);
});

test("遥测空数据与不可用均保留数据库统计", async ({ page }) => {
  await openStatistics(page, { rows: [], status: { state: "empty" } });
  await expect(
    page.getByText(/尚未观测到|Not yet observed/i, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /统计数据|Usage Statistics/i,
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute("**/admin/analytics/__data.json*");
  await fixture(page, "analytics", {
    rows: [],
    status: { state: "unavailable", reason: "query_failed" },
  });
  await page
    .getByRole("link", { name: /最近 7 天|Last 7 days/i, exact: true })
    .click();
  await expect(
    page.getByText(/使用遥测不可用|Usage telemetry unavailable/i, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/逐用户浏览轨迹|per-user browsing trails/i),
  ).toBeVisible();
});

test("日志页集中显示异常样本，审计与异常筛选互不混淆", async ({
  page,
}, testInfo) => {
  await signInAsDevAdmin(page, "/admin/analytics");
  await fixture(page, "audit", {
    errorSamples: [sample],
    errorsStatus: { state: "ready" },
    errorsTruncated: true,
  });
  await page
    .getByRole("link", {
      name: /操作与异常日志|Operations and Issues/i,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("cell", { name: sample.requestId, exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/最新的 20|20 latest/i)).toBeVisible();
  await page.locator("#issue-feature").selectOption("workspace.homework");
  await page.locator("#issue-protocol").selectOption("mcp");
  await page
    .getByRole("button", { name: /筛选异常|Filter issues/i, exact: true })
    .click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("issue_feature") === "workspace.homework" &&
      url.searchParams.get("issue_protocol") === "mcp",
  );
  await page.locator("#audit-outcome").selectOption("denied");
  await page
    .getByRole("button", { name: /应用筛选|Apply filters/i, exact: true })
    .click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("outcome") === "denied" &&
      url.searchParams.get("issue_feature") === "workspace.homework",
  );
  await captureStepScreenshot(page, testInfo, "admin-operations/issues");
});

test("统计矩阵和异常面板在移动端无页面横向溢出", async ({ page }, testInfo) => {
  await openStatistics(page, { rows: [readyRow], status: { state: "ready" } });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByText("catalog.search · view", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByText("catalog.search · view", { exact: true })
    .scrollIntoViewIfNeeded();
  await captureStepScreenshot(page, testInfo, "admin-statistics/mobile");
});

test("统计数据页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/admin/analytics", testInfo });
});
