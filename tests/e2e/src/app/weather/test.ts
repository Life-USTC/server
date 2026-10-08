/**
 * E2E tests for /catalog/weather page
 *
 * Public weather page rendering the two tracked USTC campus locations.
 * The page contract reads explicit fresh snapshots in its private Worker;
 * chart interactions keep their independently specified page-data fixtures.
 */

import { expect } from "@playwright/test";
import {
  formatShanghaiDate,
  formatShanghaiTime,
} from "@/lib/time/shanghai-format";
import { test } from "../../../utils/personal-preferences-fixture";
import { arrangeWeatherCache } from "../../../utils/weather-cache-fixture";
import { showWeatherFixture } from "../../../utils/weather-fixture";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/catalog/weather", () => {
  test("页面契约", { tag: "@Weather/Web" }, async ({
    page,
    preferenceFlow,
    request,
  }) => {
    await preferenceFlow.run(async () => {
      await preferenceFlow.prepare(() => arrangeWeatherCache(request));
      await assertPageContract(page, {
        routePath: "/catalog/weather",
      });
    });
  });

  test("weather.two-locations-only", { tag: "@Weather/Web" }, async ({
    page,
    preferenceFlow,
    isolatedWorker,
  }) => {
    await preferenceFlow.run(async () => {
      for (const locale of ["zh-cn", "en-us"] as const) {
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await showWeatherFixture(page);
          const selector = "#main-content h2";
          const headings = page.locator(selector);
          expect(new URL(page.url()).pathname).toBe("/catalog/weather");
          await expect(headings).toHaveText(
            locale === "zh-cn"
              ? ["本部", "高新校区"]
              : ["Main campus", "Gaoxin campus"],
          );
          expect(
            await headings.evaluateAll((nodes) =>
              nodes.map((node) => node.getAttribute("data-weather-location")),
            ),
          ).toEqual(["ustc-main", "ustc-gaoxin"]);
          await expect(page.getByTestId("weather-location")).toHaveCount(2);
          await expect(page.getByTestId("weather-hourly-chart")).toHaveCount(2);
          await expect(
            page.getByTestId("weather-hourly-scroll-region"),
          ).toHaveCount(0);
        }
      }
    });
  });
});

for (const width of [1280, 390]) {
  test(`逐小时预报支持边缘悬停和键盘浏览 ${width}`, {
    tag: "@Weather/Web",
  }, async ({ page, preferenceFlow }) => {
    await preferenceFlow.run(async () => {
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
      await expect(
        page.getByTestId("weather-hourly-scroll-region"),
      ).toHaveCount(0);
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
  });
}

test("weather.missing-current-display", { tag: "@Weather/Web" }, async ({
  page,
  preferenceFlow,
}) => {
  await preferenceFlow.run(async () => {
    await showWeatherFixture(page, null);

    await expect(page.getByTestId("weather-temperature").first()).toHaveText(
      "—",
    );
  });
});
