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
import {
  isolateSingleActiveBusTripFixture,
  restoreBusTripTimesFixture,
} from "../../../utils/e2e-db";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";

function busTimeAtOffset(minutes: number) {
  const value = new Date(Date.now() + minutes * 60_000);
  return `${String(value.getHours()).padStart(2, "0")}:${String(
    value.getMinutes(),
  ).padStart(2, "0")}`;
}

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

  test("移动端地图保持可读尺寸并可水平滚动", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, "/bus-map", {
      testInfo,
      screenshotLabel: "bus-map-mobile",
    });

    const svg = page.locator('main svg[role="img"][aria-label]').first();
    await expect(svg).toBeVisible();
    await svg.scrollIntoViewIfNeeded();

    const geometry = await svg.evaluate((node) => {
      const svgElement = node as SVGSVGElement;
      const viewport = svgElement.closest(
        '[data-slot="scroll-area-viewport"]',
      ) as HTMLElement | null;
      if (!viewport) throw new Error("Bus map scroll viewport missing");

      const labelHeights = Array.from(
        svgElement.querySelectorAll("text"),
        (label) => label.getBoundingClientRect().height,
      );
      const viewportBox = viewport.getBoundingClientRect();
      const campusLabels = Array.from(svgElement.querySelectorAll("g"))
        .filter(
          (group) => group.querySelectorAll(":scope > circle").length >= 3,
        )
        .map((group) => group.querySelector(":scope > text"))
        .filter((label): label is SVGTextElement => label !== null);
      const campusLabelGeometry = campusLabels.map((label) => {
        const node = label.parentElement?.querySelector("circle");
        if (!node) throw new Error("Bus map campus node missing");
        const labelBox = label.getBoundingClientRect();
        const nodeBox = node.getBoundingClientRect();
        return {
          label: label.textContent?.trim() ?? "",
          labelLeft: labelBox.left,
          labelRight: labelBox.right,
          nodeLeft: nodeBox.left,
          nodeRight: nodeBox.right,
          paintOrder: label.getAttribute("paint-order"),
        };
      });
      const visibleCampusLabels = campusLabels.filter((label) => {
        const labelBox = label.getBoundingClientRect();
        return (
          labelBox.left >= viewportBox.left &&
          labelBox.right <= viewportBox.right &&
          labelBox.top >= viewportBox.top &&
          labelBox.bottom <= viewportBox.bottom
        );
      });
      return {
        campusLabelCount: campusLabels.length,
        campusLabelGeometry,
        labelHeights,
        svgWidth: svgElement.getBoundingClientRect().width,
        viewBoxWidth: svgElement.viewBox.baseVal.width,
        viewportClientWidth: viewport.clientWidth,
        viewportScrollLeft: viewport.scrollLeft,
        viewportScrollWidth: viewport.scrollWidth,
        visibleCampusLabelCount: visibleCampusLabels.length,
      };
    });

    expect(geometry.viewBoxWidth).toBe(900);
    expect(geometry.svgWidth).toBeGreaterThanOrEqual(700);
    expect(geometry.viewportScrollWidth).toBeGreaterThan(
      geometry.viewportClientWidth,
    );
    expect(geometry.viewportScrollLeft).toBeGreaterThan(0);
    expect(geometry.campusLabelCount).toBeGreaterThan(0);
    expect(geometry.visibleCampusLabelCount).toBe(geometry.campusLabelCount);
    expect(geometry.labelHeights).not.toHaveLength(0);
    expect(Math.min(...geometry.labelHeights)).toBeGreaterThanOrEqual(10);
    expect(
      geometry.campusLabelGeometry.every(
        (label) => label.paintOrder === "stroke",
      ),
    ).toBe(true);
    const highTechLabel = geometry.campusLabelGeometry.find(
      (label) => label.label === "高新",
    );
    const researchInstituteLabel = geometry.campusLabelGeometry.find(
      (label) => label.label === "先研院",
    );
    expect(highTechLabel?.labelRight).toBeLessThan(
      highTechLabel?.nodeLeft ?? 0,
    );
    expect(researchInstituteLabel?.labelLeft).toBeGreaterThan(
      researchInstituteLabel?.nodeRight ?? Number.POSITIVE_INFINITY,
    );

    await captureStepScreenshot(page, testInfo, "bus-map-mobile-readable");

    const scrollViewport = svg.locator(
      'xpath=ancestor::*[@data-slot="scroll-area-viewport"][1]',
    );
    await scrollViewport.evaluate((node) => {
      const viewport = node as HTMLElement;
      viewport.scrollLeft = viewport.scrollWidth - viewport.clientWidth;
    });
    await expect
      .poll(() =>
        scrollViewport.evaluate((node) => (node as HTMLElement).scrollLeft),
      )
      .toBeGreaterThan(geometry.viewportScrollLeft);
  });

  test("图例显示线路说明与状态指示器", async ({ page }, testInfo) => {
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await gotoAndWaitForReady(page, "/bus-map", {
      testInfo,
      screenshotLabel: "bus-map",
    });

    // Legend section should exist
    await expect(page.getByText(/Legend|图例/).first()).toBeVisible();

    // At least one route description visible in legend
    const legend = page.getByTestId("bus-map-legend");
    const recommendedRoute = legend
      .locator("[data-slot='bus-route-description']")
      .filter({ hasText: /东区\s*→\s*西区\s*→\s*先研院\s*→\s*高新/ });
    await expect(recommendedRoute).toBeVisible();
    await expect(recommendedRoute).toHaveCount(1);
    await expect(
      page.getByRole("button").filter({
        hasText: DEV_SEED.bus.recommendedRoute,
      }),
    ).toHaveCount(0);

    // Status indicators in legend
    await expect(page.getByText(/En route|行驶中/).first()).toBeVisible();
    await expect(page.getByText(/Departing|即将发车/).first()).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    expect(runtimeErrors).toEqual([]);
  });

  test("280px 图例保持整段箭头换行且主要操作可触控", async ({ page }) => {
    await page.setViewportSize({ width: 280, height: 900 });
    await gotoAndWaitForReady(page, "/bus-map");

    const legend = page.getByTestId("bus-map-legend");
    await legend.scrollIntoViewIfNeeded();
    const route = legend
      .locator("[data-slot='bus-route-description']")
      .filter({ hasText: /东区\s*→\s*西区\s*→\s*先研院\s*→\s*高新/ });
    await expect(route).toBeVisible();
    const routeTokens = route.locator(":scope > span");
    await expect(routeTokens).toHaveCount(4);
    for (const token of await routeTokens.all()) {
      await expect(token).toHaveCSS("white-space", "nowrap");
    }

    for (const target of [
      page.getByRole("link", { name: /Back to timetable|返回时刻表/ }),
      page.getByRole("button", { name: /Refresh|刷新/ }),
    ]) {
      const box = await target.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await expectNoPageHorizontalOverflow(page);
  });

  test("统计摘要保持紧凑且单条运行班次不占固定高度", async ({ page }) => {
    const snapshot = await isolateSingleActiveBusTripFixture([
      busTimeAtOffset(-5),
      busTimeAtOffset(15),
    ]);

    try {
      for (const width of [280, 320, 375, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(page, "/bus-map");

        const summary = page.getByTestId("bus-map-summary");
        await expect(summary).toBeVisible();
        const columnCount = await summary.evaluate(
          (node) =>
            getComputedStyle(node).gridTemplateColumns.split(/\s+/).length,
        );
        expect(columnCount).toBe(width >= 1024 ? 4 : 2);

        const activeTrips = page.getByTestId("bus-map-active-trips");
        await expect(activeTrips).toBeVisible();
        const geometry = await activeTrips.evaluate((node) => {
          const viewport = node.querySelector(
            "[data-slot='scroll-area-viewport']",
          );
          const list = node.querySelector("[role='list']");
          if (!(viewport instanceof HTMLElement) || !list) {
            throw new Error("运行班次滚动区域结构缺失");
          }
          return {
            listHeight: list.getBoundingClientRect().height,
            rootHeight: node.getBoundingClientRect().height,
            viewportHeight: viewport.getBoundingClientRect().height,
            viewportScrollHeight: viewport.scrollHeight,
          };
        });
        expect(geometry.rootHeight).toBeLessThan(140);
        expect(geometry.viewportHeight).toBeLessThanOrEqual(
          geometry.listHeight,
        );
        expect(geometry.viewportScrollHeight).toBeLessThanOrEqual(140);
        await expectNoPageHorizontalOverflow(page);
      }
    } finally {
      await restoreBusTripTimesFixture(snapshot);
    }
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
    expect((await backLink.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
      44,
    );
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
    expect(
      (await refreshBtn.boundingBox())?.height ?? 0,
    ).toBeGreaterThanOrEqual(44);
    await refreshBtn.click();
    await expect(refreshBtn).toBeVisible();
  });
});
