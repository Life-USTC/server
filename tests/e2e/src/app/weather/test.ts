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
import type { WeatherSnapshot } from "../../../../../src/features/weather/server/weather-types";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";
import {
  arrangeWeatherCache,
  readWeatherCache,
  weatherProviderFailureResponses,
} from "../../../utils/weather-cache-fixture";
import { showWeatherFixture } from "../../../utils/weather-fixture";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/catalog/weather", () => {
  test("页面契约", { tag: "@Weather/Web" }, async ({
    page,
    preferenceFlow,
    isolatedWorker,
  }) => {
    await preferenceFlow.run(async () => {
      await preferenceFlow.prepare(() =>
        arrangeWeatherCache(isolatedWorker.origin),
      );
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
          expect(new URL(page.url()).pathname).toBe("/catalog/weather");

          if (width >= 768) {
            const headings = page.locator(
              "#main-content [data-testid='weather-campus-grid'] h2",
            );
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
            await expect(
              page
                .getByTestId("weather-campus-grid")
                .getByTestId("weather-location"),
            ).toHaveCount(2);
            await expect(
              page
                .getByTestId("weather-campus-grid")
                .getByTestId("weather-hourly-chart"),
            ).toHaveCount(2);
          } else {
            const tabs = page.getByTestId("weather-campus-tabs");
            await expect(tabs.getByRole("tab")).toHaveText(
              locale === "zh-cn" ? ["本部", "高新"] : ["Main", "Gaoxin"],
            );
            for (const [index, key] of (
              ["ustc-main", "ustc-gaoxin"] as const
            ).entries()) {
              await tabs.getByRole("tab").nth(index).click();
              const visibleLocation = tabs.locator(
                '[data-testid="weather-location"]:visible',
              );
              await expect(visibleLocation).toHaveAttribute(
                "data-weather-location",
                key,
              );
              await expect(
                tabs.locator('[data-testid="weather-hourly-chart"]:visible'),
              ).toHaveCount(1);
            }
          }
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
      const chart = page
        .locator('[data-testid="weather-hourly-chart"]:visible')
        .first();
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

    await expect(
      page.locator('[data-testid="weather-temperature"]:visible').first(),
    ).toHaveText("—");
  });
});

test.describe("weather known missing states", () => {
  test.use({
    workerBindings: { AMAP_API_KEY: "" },
    workerOutboundJson: [weatherProviderFailureResponses, { scope: "test" }],
    workerOutboundRejectOrigins: ["https://api.open-meteo.com"],
  });
  for (const [locale, width] of [
    ["en-us", 1280],
    ["zh-cn", 390],
  ] as const) {
    test(`weather.known-state-display ${locale} ${width}`, {
      tag: "@Weather/Web",
    }, async ({ page, preferenceFlow, isolatedWorker }) => {
      await preferenceFlow.run(async () => {
        const origin = isolatedWorker.origin;
        const main: WeatherSnapshot = {
          location: { key: "ustc-main", name: "本部", adcode: "340100" },
          fetchedAt: new Date().toISOString(),
          providers: ["open-meteo"],
          current: {
            source: "open-meteo",
            temperature: 21,
            condition: { text: "晴", icon: "wmo-0" },
          },
          hourly: [],
          daily: [],
          alerts: [],
          extensions: {},
        };
        const unknown: WeatherSnapshot = {
          ...main,
          providers: [],
          current: {
            temperature: null,
            condition: { text: "未知", icon: "unknown" },
          },
        };
        await page.setViewportSize({ width, height: 900 });
        await page.context().clearCookies();
        await page
          .context()
          .addCookies([{ name: "NEXT_LOCALE", value: locale, url: origin }]);
        const historyBefore =
          await isolatedWorker.database.owner.weatherObservation.findMany();
        for (const [phase, input] of [main, unknown].entries()) {
          await preferenceFlow.prepare(() =>
            arrangeWeatherCache(origin, [input]),
          );
          await gotoAndWaitForReady(page, "/catalog/weather");
          const mainRegion = page.locator("#main-content");
          await expect(
            mainRegion.getByRole("heading", { level: 1 }),
          ).toHaveText(locale === "en-us" ? "Campus Weather" : "校园天气");
          for (const key of ["ustc-main", "ustc-gaoxin"] as const) {
            if (width < 768) {
              await page
                .getByTestId("weather-campus-tabs")
                .getByRole("tab", {
                  name:
                    key === "ustc-main"
                      ? locale === "en-us"
                        ? "Main"
                        : "本部"
                      : locale === "en-us"
                        ? "Gaoxin"
                        : "高新",
                  exact: true,
                })
                .click();
            }
            const heading = mainRegion
              .locator(`h2[data-weather-location="${key}"]`)
              .filter({ visible: true });
            await expect(heading).toBeVisible();
            const region = heading.locator(
              'xpath=ancestor::*[@data-slot="page-section"][1]',
            );
            if (key === "ustc-gaoxin") {
              await expect(
                region.getByTestId("weather-unavailable"),
              ).toHaveText(
                locale === "en-us"
                  ? "Weather data is temporarily unavailable. Please try again later."
                  : "天气数据暂不可用，请稍后重试。",
              );
              await expect(
                region.getByTestId("weather-temperature"),
              ).toHaveCount(0);
            } else {
              await expect(
                region.getByTestId("weather-unavailable"),
              ).toHaveCount(0);
              await expect(
                region.getByTestId("weather-temperature"),
              ).toHaveText(phase === 0 ? "21°" : "—");
              await expect(region.getByTestId("weather-condition")).toHaveText(
                phase === 0 ? "晴" : "未知",
              );
            }
            for (const label of locale === "en-us"
              ? ["Feels like", "Humidity", "Wind"]
              : ["体感温度", "湿度", "风"]) {
              await expect(
                region.getByText(label, { exact: true }),
              ).toHaveCount(0);
            }
            await expect(
              region.getByTestId("weather-temperature-range"),
            ).toHaveCount(0);
            await expect(
              region.getByTestId("weather-hourly-chart"),
            ).toHaveCount(0);
            await expect(
              region.getByRole("heading", {
                name: locale === "en-us" ? "Daily forecast" : "每日预报",
                exact: true,
              }),
            ).toHaveCount(0);
          }
          const meta = page.getByTestId("weather-page-meta");
          await expect(meta).toBeVisible();
          const updatedTime = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Shanghai",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(new Date(input.fetchedAt));
          await expect(meta.locator("span").first()).toHaveText(
            locale === "en-us"
              ? `Updated ${updatedTime}`
              : `更新于 ${updatedTime}`,
          );
          if (phase === 0)
            await expect(meta).toContainText(
              locale === "en-us"
                ? "Data providers: open-meteo"
                : "数据来源: open-meteo",
            );
          else {
            await expect(meta).not.toContainText("open-meteo");
            await expect(meta).not.toContainText(
              locale === "en-us" ? "Data providers" : "数据来源",
            );
          }
          expect(await readWeatherCache(origin, "ustc-main")).toEqual(input);
          await expect
            .poll(() => ({
              matched: isolatedWorker.outboundJsonObservations.matched,
              rejected: isolatedWorker.outboundJsonObservations.rejected,
            }))
            .toEqual({
              matched: Array(phase + 1).fill(
                weatherProviderFailureResponses[1].url,
              ),
              rejected: [],
            });
          expect(
            await isolatedWorker.database.owner.weatherObservation.findMany(),
          ).toEqual(historyBefore);
        }
      });
    });
  }
});
