/**
 * E2E tests for the bus transit map page (/catalog/bus/map)
 *
 * ## Behavior
 * - Page renders a metro-map style SVG visualization of campus shuttle routes
 * - Campus nodes shown as labeled circles positioned based on geographic data
 * - Route lines drawn between connected campuses, color-coded per route
 * - Active trips (en-route, departing-soon) shown with animated indicators
 * - Auto-refreshes every 60 seconds; manual refresh button available
 * - "Experimental" badge shown in header
 *
 * ## Edge Cases
 * - Page works without authentication (public data)
 * - Empty state shown when no bus data is available
 * - Responsive: SVG scales within a height-capped aspect box
 */
import { expect, test } from "@playwright/test";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";

test.describe("校车线路图", () => {
  test("SVG 中渲染校区节点与线路", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/catalog/bus/map", {
      testInfo,
      screenshotLabel: "bus-map",
    });

    await expect(page.getByText(/Transit Map|线路图/).first()).toBeVisible();
    await expect(
      page.getByText(/Experimental|实验性功能/).first(),
    ).toBeVisible();
    await expect(page.getByText(/返回时刻表|Back to timetable/)).toHaveCount(0);
    await expect(page.getByTestId("bus-map-summary")).toHaveCount(0);
    await expect(page.getByTestId("bus-map-legend")).toHaveCount(0);
    await expect(page.getByText(/线路概览|Network overview/)).toHaveCount(0);

    const svg = page.locator('main svg[role="img"][aria-label]').first();
    await expect(svg).toBeVisible();

    const circles = svg.locator("circle");
    const circleCount = await circles.count();
    expect(circleCount).toBeGreaterThanOrEqual(6);

    const paths = svg.locator("path");
    await expect(paths.first()).toBeVisible();
    const pathCount = await paths.count();
    expect(pathCount).toBeGreaterThan(0);

    await captureStepScreenshot(page, testInfo, "bus-map-overview");
  });

  test("移动端地图按容器宽度缩放且不造成页面溢出", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, "/catalog/bus/map", {
      testInfo,
      screenshotLabel: "bus-map-mobile",
    });

    const svg = page.locator('main svg[role="img"][aria-label]').first();
    await expect(svg).toBeVisible();
    await svg.scrollIntoViewIfNeeded();

    const geometry = await svg.evaluate((node) => {
      const svgElement = node as SVGSVGElement;
      const section = svgElement.closest("section");
      if (!section) throw new Error("Bus map section missing");

      const labelHeights = Array.from(
        svgElement.querySelectorAll("text"),
        (label) => label.getBoundingClientRect().height,
      );
      const campusLabels = Array.from(svgElement.querySelectorAll("g"))
        .filter(
          (group) => group.querySelectorAll(":scope > circle").length >= 3,
        )
        .map((group) => group.querySelector(":scope > text"))
        .filter((label): label is SVGTextElement => label !== null);
      const campusLabelGeometry = campusLabels.map((label) => {
        const nodeCircle = label.parentElement?.querySelector("circle");
        if (!nodeCircle) throw new Error("Bus map campus node missing");
        const labelBox = label.getBoundingClientRect();
        const nodeBox = nodeCircle.getBoundingClientRect();
        return {
          label: label.textContent?.trim() ?? "",
          labelLeft: labelBox.left,
          labelRight: labelBox.right,
          nodeLeft: nodeBox.left,
          nodeRight: nodeBox.right,
          paintOrder: label.getAttribute("paint-order"),
        };
      });
      return {
        campusLabelCount: campusLabels.length,
        campusLabelGeometry,
        labelHeights,
        sectionWidth: section.getBoundingClientRect().width,
        svgHeight: svgElement.getBoundingClientRect().height,
        svgWidth: svgElement.getBoundingClientRect().width,
        viewBoxHeight: svgElement.viewBox.baseVal.height,
        viewBoxWidth: svgElement.viewBox.baseVal.width,
      };
    });

    expect(geometry.viewBoxWidth).toBeGreaterThan(0);
    expect(
      geometry.viewBoxWidth / geometry.viewBoxHeight,
    ).toBeGreaterThanOrEqual(1.2 - 1e-6);
    expect(geometry.svgWidth).toBeLessThanOrEqual(geometry.sectionWidth + 1);
    expect(geometry.svgHeight).toBeLessThanOrEqual(26 * 16 + 1);
    expect(geometry.svgHeight).toBeCloseTo(
      (geometry.svgWidth * geometry.viewBoxHeight) / geometry.viewBoxWidth,
      0,
    );
    expect(geometry.campusLabelCount).toBeGreaterThan(0);
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
    // West campuses label inward (right of the node) so text isn't cropped.
    expect(highTechLabel?.labelLeft).toBeGreaterThan(
      highTechLabel?.nodeRight ?? Number.POSITIVE_INFINITY,
    );
    expect(researchInstituteLabel?.labelLeft).toBeGreaterThan(
      researchInstituteLabel?.nodeRight ?? Number.POSITIVE_INFINITY,
    );
    // 高新 / 先研院 should sit west of the main campus cluster.
    const eastLabel = geometry.campusLabelGeometry.find(
      (label) => label.label === "东区",
    );
    expect(highTechLabel?.nodeRight).toBeLessThan(eastLabel?.nodeLeft ?? 0);
    expect(researchInstituteLabel?.nodeRight).toBeLessThan(
      eastLabel?.nodeLeft ?? 0,
    );

    await expectNoPageHorizontalOverflow(page);
    await captureStepScreenshot(page, testInfo, "bus-map-mobile-readable");
  });

  test("窄屏刷新按钮可触控", async ({ page }) => {
    await page.setViewportSize({ width: 280, height: 900 });
    await gotoAndWaitForReady(page, "/catalog/bus/map");

    const refreshBtn = page.getByRole("button", { name: /Refresh|刷新/ });
    await expect(refreshBtn).toBeVisible();
    expect(
      (await refreshBtn.boundingBox())?.height ?? 0,
    ).toBeGreaterThanOrEqual(44);
    await expectNoPageHorizontalOverflow(page);
  });

  test("刷新按钮存在", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/catalog/bus/map", {
      testInfo,
      screenshotLabel: "bus-map",
    });

    const refreshBtn = page.getByRole("button", { name: /Refresh|刷新/ });
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await expect(refreshBtn).toBeVisible();
  });
});
