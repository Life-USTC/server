import { expect, type Page, test } from "@playwright/test";
import { stringify, unflatten } from "devalue";
import { signInAsDevAdmin } from "../../../../utils/auth";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

const ids = Array.from({ length: 70 }, () => crypto.randomUUID());
const requestIds = ids.map(() => crypto.randomUUID());
test.beforeAll(async () => {
  await withE2ePrisma((db) =>
    db.featureOperationEvent.createMany({
      data: ids.map((id, index) => ({
        id,
        requestId: requestIds[index],
        occurredAt: new Date(Date.now() - 60_000 - (index % 7) * 86_400_000),
        feature: index < 10 ? "catalog.search" : "catalog.teacher",
        operation: index < 10 ? "search" : "get",
        protocol: index % 2 ? "rest" : "web",
        surface: index % 2 ? "unknown" : "web",
        authMode: "anonymous",
        outcome: index < 10 ? "success" : "error",
        errorClass: index < 10 ? "none" : "dependency",
        durationMs: 10 + index,
      })),
    }),
  );
});
test.afterAll(async () => {
  await withE2ePrisma((db) =>
    db.featureOperationEvent.deleteMany({ where: { id: { in: ids } } }),
  );
});

async function fixture(page: Page, patch: Record<string, unknown>) {
  await page.route("**/admin/analytics/__data.json*", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    let replaced = false;
    for (const node of payload.nodes ?? []) {
      if (node?.type !== "data" || !Array.isArray(node.data)) continue;
      const data = unflatten(node.data) as Record<string, unknown>;
      if (!("telemetry" in data)) continue;
      node.data = JSON.parse(
        stringify({
          ...data,
          telemetry: {
            ...(data.telemetry as Record<string, unknown>),
            ...patch,
          },
        }),
      );
      replaced = true;
    }
    expect(replaced).toBe(true);
    await route.fulfill({ response, json: payload });
  });
}

test("统计曲线支持筛选、图例与键盘，切换周期后同步更新", async ({
  page,
}, testInfo) => {
  await signInAsDevAdmin(page, "/admin/analytics");
  await expect(page.locator("#telemetry-operations-title")).toBeVisible();
  const chart = page
    .locator('section[aria-labelledby="telemetry-operations-title"]')
    .getByRole("slider");
  await chart.focus();
  await chart.press("End");
  await expect(chart).toHaveAttribute("aria-valuenow", "29");
  await page.locator("#experience-feature").selectOption("catalog.search");
  await page
    .getByRole("button", { name: /应用筛选|Apply filters/i, exact: true })
    .click();
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("feature") === "catalog.search",
  );
  await expect(page.locator('[data-series-key="operation:get"]')).toHaveCount(
    0,
  );
  await expect(
    page.locator('[data-series-key="operation:search"]').last(),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-series-key="operation:search"]').last().click();
  await expect(
    page.locator('[data-series-key="operation:search"]').last(),
  ).toHaveAttribute("aria-pressed", "false");
  await page.locator('[data-series-key="operation:search"]').last().click();
  await page
    .getByRole("link", { name: /最近 7 天|Last 7 days/i, exact: true })
    .click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("days") === "7" &&
      url.searchParams.get("feature") === "catalog.search",
  );
  await expect(chart).toHaveAttribute("aria-valuemax", "6");
  await page.locator("#telemetry-operations-title").scrollIntoViewIfNeeded();
  await captureStepScreenshot(
    page,
    testInfo,
    "admin-statistics/operation-trends",
  );
});

test("公共查询无需 Analytics 凭据即可写入 PostgreSQL 并在日志查看", async ({
  page,
}, testInfo) => {
  const response = await page.request.get("/api/catalog/courses/999999999");
  expect(response.status()).toBe(404);
  const requestId = response.headers()["x-request-id"];
  expect(requestId).toBeTruthy();
  await expect
    .poll(() =>
      withE2ePrisma((db) =>
        db.featureOperationEvent.findFirst({
          where: { requestId },
          select: {
            feature: true,
            operation: true,
            outcome: true,
            errorClass: true,
          },
        }),
      ),
    )
    .toEqual({
      feature: "catalog.course",
      operation: "get",
      outcome: "rejected",
      errorClass: "not_found",
    });
  try {
    await signInAsDevAdmin(
      page,
      "/admin/audit?issue_feature=catalog.course&issue_outcome=rejected",
    );
    const detail = page
      .locator("details")
      .filter({ has: page.getByText(requestId, { exact: true }) })
      .last();
    await detail.locator("summary").click();
    await expect(page.getByText(requestId, { exact: true })).toBeVisible();
    await captureStepScreenshot(
      page,
      testInfo,
      "admin-operations/persisted-request",
    );
  } finally {
    await withE2ePrisma((db) =>
      db.featureOperationEvent.deleteMany({ where: { requestId } }),
    );
  }
});

test("日志显示异常分组和明细，审计与操作筛选互不混淆", async ({
  page,
}, testInfo) => {
  await signInAsDevAdmin(page, "/admin/audit?issue_feature=catalog.teacher");
  await expect(page.locator("#issue-feature")).toHaveValue("catalog.teacher");
  await page.locator("#issue-protocol").selectOption("rest");
  await page
    .getByRole("button", {
      name: /筛选操作|筛选异常|Filter (?:operations|issues)/i,
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("issue_protocol") === "rest",
  );
  await page.locator("#audit-outcome").selectOption("denied");
  await page
    .getByRole("button", { name: /应用筛选|Apply filters/i, exact: true })
    .click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("outcome") === "denied" &&
      url.searchParams.get("issue_feature") === "catalog.teacher" &&
      url.searchParams.get("issue_protocol") === "rest",
  );
  await captureStepScreenshot(
    page,
    testInfo,
    "admin-operations/grouped-issues",
  );
});

test("数据库读取失败有明确状态，历史统计仍可查看", async ({ page }) => {
  await signInAsDevAdmin(page, "/admin/analytics");
  await fixture(page, {
    rows: [],
    daily: [],
    status: { state: "unavailable", reason: "query_failed" },
  });
  await page
    .getByRole("link", { name: /最近 7 天|Last 7 days/i, exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(/不可用|unavailable/i);
  await expect(
    page.getByRole("heading", {
      name: /统计数据|Usage Statistics/i,
      exact: true,
    }),
  ).toBeVisible();
});

test("移动端曲线与操作时间线无横向溢出", async ({ page }, testInfo) => {
  await signInAsDevAdmin(page, "/admin/analytics");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#telemetry-operations-title").scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await captureStepScreenshot(page, testInfo, "admin-statistics/mobile-trends");
  await gotoAndWaitForReady(page, "/admin/audit?issue_feature=catalog.teacher");

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await captureStepScreenshot(
    page,
    testInfo,
    "admin-operations/mobile-timeline",
  );
});

test("统计数据页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/admin/analytics", testInfo });
});
