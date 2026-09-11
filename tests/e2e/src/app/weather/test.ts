/**
 * E2E tests for /catalog/weather page
 *
 * Public weather page rendering the two tracked USTC campus locations.
 * Provider availability is environment-dependent, so content assertions
 * accept either live snapshots or the unavailable state.
 */

import { expect, test } from "@playwright/test";
import { formatShanghaiTime } from "@/lib/time/shanghai-format";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { showWeatherFixture } from "../../../utils/weather-fixture";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/catalog/weather", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/catalog/weather",
      testInfo,
    });
  });

  test("渲染两个校区位置面板", async ({ page }, testInfo) => {
    // 本部与高新校区两个位置面板
    await gotoAndWaitForReady(page, "/catalog/weather", {
      testInfo,
      screenshotLabel: "weather",
    });
    await waitForUiSettled(page);

    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();

    const headings = page.locator("h2");
    await expect(headings).toHaveCount(2);
    await expect(headings.filter({ hasText: /本部|Main campus/ })).toHaveCount(
      1,
    );
    await expect(
      headings.filter({ hasText: /高新校区|Gaoxin campus/ }),
    ).toHaveCount(1);

    const panels = page.locator(
      '[data-testid="weather-location"], [data-testid="weather-unavailable"]',
    );
    await expect(panels.first()).toBeVisible();
    expect(await panels.count()).toBe(2);

    await expect(page.getByTestId("weather-hourly-scroll-region")).toHaveCount(
      0,
    );
  });
});

for (const width of [1280, 390]) {
  test(`逐小时预报支持边缘悬停和键盘浏览 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const snapshot = await showWeatherFixture(page);
    const chart = page.getByTestId("weather-hourly-chart").first();
    const slider = chart.getByRole("slider");
    const tooltip = chart.getByRole("tooltip");
    await expect(tooltip).toHaveCount(0);
    await expect(page.getByTestId("weather-hourly-scroll-region")).toHaveCount(
      0,
    );
    const box = await slider.boundingBox();
    if (!box) throw new Error("Expected chart bounds");
    for (const position of [0, 1]) {
      await slider.hover({
        position: { x: position ? box.width - 1 : 1, y: 40 },
      });
      const hour = snapshot.hourly[position ? snapshot.hourly.length - 1 : 0];
      await expect(tooltip).toContainText(formatShanghaiTime(hour.at));
      await expect(tooltip).toContainText(`${hour.temperature}°C`);
      const bounds = await tooltip.boundingBox();
      expect(bounds?.x).toBeGreaterThanOrEqual(box.x - 1);
      expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
        box.x + box.width + 1,
      );
    }
    await page.mouse.move(0, 0);
    await expect(tooltip).toHaveCount(0);
    await slider.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await expect(tooltip).toContainText(
      formatShanghaiTime(snapshot.hourly[1].at),
    );
    await page.keyboard.press("End");
    await expect(slider).toHaveAttribute(
      "aria-valuenow",
      String(snapshot.hourly.length - 1),
    );
    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
    if (width === 390) {
      await slider.dispatchEvent("pointerdown", {
        pointerType: "touch",
        clientX: box.x + box.width / 2,
        clientY: box.y + 40,
      });
      await expect(tooltip).toBeVisible();
    }
  });
}
