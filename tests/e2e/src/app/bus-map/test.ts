/**
 * E2E tests for the bus transit map page (/bus-map)
 *
 * ## Behavior
 * - Page renders a metro-map style SVG visualization of campus shuttle routes
 * - Campus nodes shown as labeled circles positioned based on geographic data
 * - Route lines drawn between connected campuses, color-coded per route
 * - Active trips (en-route, departing-soon) shown with animated indicators
 * - Legend sidebar lists all routes with colors + status indicators
 * - Auto-refreshes every 60 seconds; manual refresh button available
 * - "Experimental" badge shown in header
 * - "Back to timetable" link returns to /dashboard/bus
 *
 * ## Edge Cases
 * - Page works without authentication (public data)
 * - Empty state shown when no bus data is available
 * - Responsive: SVG scales to container width
 */
import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";

test.describe("校车线路图", () => {
  test("SVG 中渲染校区节点与线路", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/bus-map", {
      testInfo,
      screenshotLabel: "bus-map",
    });

    // Page title and experimental badge
    await expect(page.getByText(/Transit Map|线路图/).first()).toBeVisible();
    await expect(
      page.getByText(/Experimental|实验性功能/).first(),
    ).toBeVisible();

    // SVG map is rendered with campus nodes and route lines
    const svg = page.locator('main svg[role="img"][aria-label]').first();
    await expect(svg).toBeVisible();

    // Campus circles rendered inside SVG (2 circles per campus: outer + inner ring)
    const circles = svg.locator("circle");
    const circleCount = await circles.count();
    expect(circleCount).toBeGreaterThanOrEqual(6);

    // Route polylines rendered inside SVG (metro-style parallel tracks)
    const paths = svg.locator("path");
    await expect(paths.first()).toBeVisible();
    const pathCount = await paths.count();
    expect(pathCount).toBeGreaterThan(0);

    await captureStepScreenshot(page, testInfo, "bus-map-overview");
  });

  test("图例显示线路说明与状态指示器", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/bus-map", {
      testInfo,
      screenshotLabel: "bus-map",
    });

    // Legend section should exist
    await expect(page.getByText(/Legend|图例/).first()).toBeVisible();

    // At least one route description visible in legend
    await expect(
      page.getByText(DEV_SEED.bus.recommendedRoute, { exact: false }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button").filter({
        hasText: DEV_SEED.bus.recommendedRoute,
      }),
    ).toHaveCount(0);

    // Status indicators in legend
    await expect(page.getByText(/En route|行驶中/).first()).toBeVisible();
    await expect(page.getByText(/Departing|即将发车/).first()).toBeVisible();
  });

  test("返回链接导航到校车标签页", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/bus-map", {
      testInfo,
      screenshotLabel: "bus-map",
    });

    const backLink = page
      .getByRole("link", { name: /Back to timetable|返回时刻表/ })
      .first();
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute("href", "/dashboard/bus");
  });

  test("侧边栏显示日期类型与时间信息", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/bus-map", {
      testInfo,
      screenshotLabel: "bus-map",
    });

    // Day type label (weekday or weekend)
    await expect(
      page.getByText(/Weekday|Weekend|工作日|周末/).first(),
    ).toBeVisible();
  });

  test("刷新按钮存在", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/bus-map", {
      testInfo,
      screenshotLabel: "bus-map",
    });

    const refreshBtn = page.getByRole("button", { name: /Refresh|刷新/ });
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await expect(refreshBtn).toBeVisible();
  });
});
