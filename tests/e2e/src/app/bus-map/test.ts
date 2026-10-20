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
 * - Responsive: SVG scales to the viewport under shell chrome
 */
import { expect } from "@playwright/test";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../utils/page-ready";
import { busTest as test } from "../../../utils/personal-preferences-fixture";
import { assertPageContract } from "../_shared/page-contract";

test.describe("校车线路图", () => {
  test("SVG 中渲染校区节点与线路", { tag: "@Bus/Web" }, async ({
    page,
    preferenceFlow,
  }) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, "/catalog/bus/map");

      await expect(page.getByText(/Transit Map|线路图/).first()).toBeVisible();
      await expect(
        page.getByText(/Experimental|实验性功能/).first(),
      ).toBeVisible();
      await expect(page.getByText(/返回时刻表|Back to timetable/)).toHaveCount(
        0,
      );
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
    });
  });

  test("移动端地图按容器宽度缩放且不造成页面溢出", { tag: "@Bus/Web" }, async ({
    page,
    preferenceFlow,
  }) => {
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoAndWaitForReady(page, "/catalog/bus/map");

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
            fontSizePx: Number.parseFloat(getComputedStyle(label).fontSize),
            labelLeft: labelBox.left,
            labelRight: labelBox.right,
            nodeLeft: nodeBox.left,
            nodeRight: nodeBox.right,
            paintOrder: label.getAttribute("paint-order"),
          };
        });
        const canvas = svgElement.closest(".bus-map-canvas");
        if (!canvas) throw new Error("Bus map canvas missing");
        return {
          campusLabelCount: campusLabels.length,
          campusLabelGeometry,
          canvasHeight: canvas.getBoundingClientRect().height,
          labelHeights,
          sectionHeight: section.getBoundingClientRect().height,
          sectionWidth: section.getBoundingClientRect().width,
          svgHeight: svgElement.getBoundingClientRect().height,
          svgWidth: svgElement.getBoundingClientRect().width,
          viewBoxHeight: svgElement.viewBox.baseVal.height,
          viewBoxWidth: svgElement.viewBox.baseVal.width,
          viewportHeight: window.innerHeight,
        };
      });

      expect(geometry.viewBoxWidth).toBeGreaterThan(0);
      expect(
        geometry.viewBoxWidth / geometry.viewBoxHeight,
      ).toBeGreaterThanOrEqual(1.2 - 1e-6);
      expect(geometry.svgWidth).toBeLessThanOrEqual(geometry.sectionWidth + 1);
      expect(geometry.svgHeight).toBeLessThanOrEqual(geometry.canvasHeight + 1);
      expect(geometry.sectionHeight).toBeGreaterThan(
        geometry.viewportHeight * 0.55,
      );
      expect(geometry.svgWidth).toBeCloseTo(geometry.sectionWidth, 0);
      expect(geometry.svgHeight).toBeCloseTo(
        (geometry.svgWidth * geometry.viewBoxHeight) / geometry.viewBoxWidth,
        0,
      );
      expect(geometry.campusLabelCount).toBeGreaterThan(0);
      expect(geometry.labelHeights).not.toHaveLength(0);
      // #372: mobile labels must stay legible after viewBox compression.
      expect(Math.min(...geometry.labelHeights)).toBeGreaterThanOrEqual(10);
      expect(
        geometry.campusLabelGeometry.every(
          (label) => label.paintOrder === "stroke",
        ),
      ).toBe(true);
      expect(
        geometry.campusLabelGeometry.every((label) => label.fontSizePx === 28),
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
    });
  });

  test("桌面端节点半径与标签字号约为历史值一半且不压过线路描边", {
    tag: "@Bus/Web",
  }, async ({ page, preferenceFlow }) => {
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await gotoAndWaitForReady(page, "/catalog/bus/map");
      const svg = page.locator('main svg[role="img"][aria-label]').first();
      await expect(svg).toBeVisible();

      const metrics = await svg.evaluate((node) => {
        const svgElement = node as SVGSVGElement;
        const campusGroups = Array.from(
          svgElement.querySelectorAll("g"),
        ).filter(
          (group) => group.querySelectorAll(":scope > circle").length >= 3,
        );
        const midRadii = campusGroups.map((group) => {
          const circles = Array.from(group.querySelectorAll(":scope > circle"));
          const mid = circles[1] ?? circles[0];
          return Number.parseFloat(mid.getAttribute("r") ?? "0");
        });
        const primaryLabels = campusGroups
          .map((group) => group.querySelector(":scope > text"))
          .filter((label): label is SVGTextElement => label !== null);
        const labelFontSizes = primaryLabels.map((label) =>
          Number.parseFloat(getComputedStyle(label).fontSize),
        );
        const routeStrokes = Array.from(svgElement.querySelectorAll("path"))
          .map((path) =>
            Number.parseFloat(path.getAttribute("stroke-width") ?? "0"),
          )
          .filter((width) => width > 0 && width < 12);
        return {
          maxMidRadius: Math.max(...midRadii, 0),
          maxRouteStroke: Math.max(...routeStrokes, 0),
          minLabelFontSize: Math.min(...labelFontSizes),
          maxLabelFontSize: Math.max(...labelFontSizes),
        };
      });

      expect(metrics.maxMidRadius).toBe(14);
      expect(metrics.minLabelFontSize).toBe(14);
      expect(metrics.maxLabelFontSize).toBe(14);
      // Mid-ring radius should stay in the same ballpark as colored route strokes
      // (halo paths at 14 are excluded) so stations no longer dominate the graph.
      expect(metrics.maxMidRadius).toBeLessThanOrEqual(
        metrics.maxRouteStroke * 3.2,
      );
    });
  });

  test("地图使用可用视口高度且随窗口缩放", { tag: "@Bus/Web" }, async ({
    page,
    preferenceFlow,
  }) => {
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await gotoAndWaitForReady(page, "/catalog/bus/map");
      const svg = page.locator('main svg[role="img"][aria-label]').first();
      await expect(svg).toBeVisible();

      for (const height of [1000, 600]) {
        await page.setViewportSize({ width: 1440, height });
        await expect(async () => {
          const geometry = await svg.evaluate((node) => {
            const map = node as SVGSVGElement;
            const canvas = map.parentElement;
            const section = map.closest("section");
            const topbar = document.querySelector("[data-shell-topbar]");
            if (!canvas || !section || !topbar)
              throw new Error("Missing map layout");
            return {
              map: map.getBoundingClientRect().toJSON(),
              canvas: canvas.getBoundingClientRect().toJSON(),
              section: section.getBoundingClientRect().toJSON(),
              topbar: topbar.getBoundingClientRect().toJSON(),
              ratio: map.viewBox.baseVal.width / map.viewBox.baseVal.height,
              padding:
                2 *
                Number.parseFloat(
                  getComputedStyle(document.documentElement).fontSize,
                ),
            };
          });
          expect(geometry.section.height).toBeCloseTo(
            height - geometry.topbar.height - geometry.padding,
            0,
          );
          expect(geometry.map.height).toBeCloseTo(
            Math.min(
              geometry.canvas.height,
              geometry.canvas.width / geometry.ratio,
            ),
            0,
          );
          expect(geometry.map.bottom).toBeLessThanOrEqual(height);
          expect(geometry.map.width / geometry.map.height).toBeCloseTo(
            geometry.ratio,
            2,
          );
          if (height === 1000)
            expect(geometry.map.height).toBeGreaterThan(26 * 16);
        }).toPass({ timeout: 5_000 });
        await expectNoPageHorizontalOverflow(page);
      }
    });
  });

  test("窄屏刷新按钮可触控", { tag: "@Bus/Web" }, async ({
    page,
    preferenceFlow,
  }) => {
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width: 280, height: 900 });
      await gotoAndWaitForReady(page, "/catalog/bus/map");

      const refreshBtn = page.getByRole("button", { name: /Refresh|刷新/ });
      await expect(refreshBtn).toBeVisible();
      expect(
        (await refreshBtn.boundingBox())?.height ?? 0,
      ).toBeGreaterThanOrEqual(44);
      await expectNoPageHorizontalOverflow(page);
    });
  });

  test("刷新按钮存在", { tag: "@Bus/Web" }, async ({
    page,
    preferenceFlow,
  }) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, "/catalog/bus/map");

      const refreshBtn = page.getByRole("button", { name: /Refresh|刷新/ });
      await expect(refreshBtn).toBeVisible();
      await refreshBtn.click();
      await expect(refreshBtn).toBeVisible();
    });
  });
});

test("页面契约", { tag: "@Bus/Web" }, async ({ page, preferenceFlow }) => {
  await preferenceFlow.run(async () => {
    await assertPageContract(page, { routePath: "/catalog/bus/map" });
  });
});
