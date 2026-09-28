import { semanticContract } from "../../../../shared/specifications/semantic-contract";
/**
 * E2E tests for /catalog/weather page
 *
 * Public weather page rendering the two tracked USTC campus locations.
 * Provider availability is environment-dependent, so content assertions
 * accept either live snapshots or the unavailable state.
 */

import { expect, test } from "@playwright/test";
import {
  formatShanghaiDate,
  formatShanghaiTime,
} from "@/lib/time/shanghai-format";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db/core";
import { showWeatherFixture } from "../../../utils/weather-fixture";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/catalog/weather", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/catalog/weather",
      testInfo,
    });
  });

  test("weather.two-locations-only", async ({ page }, info) => {
    const contract = await semanticContract(
      "weather.two-locations-only",
      "localized_regions",
    );
    for (const locale of ["zh-cn", "en-us"] as const) {
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: locale, url: PLAYWRIGHT_BASE_URL },
        ]);
      for (const [viewportIndex, width] of [1280, 390].entries()) {
        await page.setViewportSize({ width, height: 900 });
        contract.equal(`/viewports/${viewportIndex}`, page.viewportSize());
        await showWeatherFixture(page);
        const selector = "#main-content h2";
        const headings = page.locator(selector);
        contract.equal("/selector", selector);
        contract.equal("/route", new URL(page.url()).pathname);
        await expect(headings).toHaveText(
          locale === "zh-cn"
            ? ["本部", "高新校区"]
            : ["Main campus", "Gaoxin campus"],
        );
        contract.equal(`/labels/${locale}`, await headings.allTextContents());
        contract.equal(
          "/location_keys",
          await headings.evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("data-weather-location")),
          ),
        );
        contract.equal(
          "/regions",
          await page.getByTestId("weather-location").count(),
        );
        await expect(page.getByTestId("weather-location")).toHaveCount(2);
        await expect(page.getByTestId("weather-hourly-chart")).toHaveCount(2);
        await expect(
          page.getByTestId("weather-hourly-scroll-region"),
        ).toHaveCount(0);
      }
    }
    contract.recordPlaywright(info);
  });
});

for (const width of [1280, 390]) {
  test(`逐小时预报支持边缘悬停和键盘浏览 ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const snapshot = await showWeatherFixture(page);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new URL("/catalog/weather", page.url()).href,
    );
    const chart = page.getByTestId("weather-hourly-chart").first();
    const slider = chart.getByRole("slider");
    const tooltip = chart.getByRole("tooltip");
    await expect(slider).toHaveAttribute("aria-valuemax", "23");
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
      await expect(tooltip).toContainText(formatShanghaiDate(hour.at));
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

test("weather.missing-current-display", async ({ page }, testInfo) => {
  await showWeatherFixture(page, null);
  await page.screenshot({
    path: testInfo.outputPath("weather-missing-current.png"),
    fullPage: true,
  });
  await expect(page.getByTestId("weather-temperature").first()).toHaveText("—");
});
