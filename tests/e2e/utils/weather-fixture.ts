import { expect, type Page } from "@playwright/test";
import { stringify } from "devalue";
import type { WeatherSnapshot } from "@/features/weather/server/weather-types";
import { WEATHER_LOCATIONS } from "@/features/weather/server/weather-types";
import { buildSocialMetadata } from "@/lib/social-metadata";
import enUsMessages from "../../../messages/en-us.json" with { type: "json" };
import zhCnMessages from "../../../messages/zh-cn.json" with { type: "json" };
import { appSidebar } from "./locators";
import { gotoAndWaitForReady } from "./page-ready";

export async function showWeatherFixture(
  page: Page,
  currentTemperature: number | null = 24,
  observations: Pick<WeatherSnapshot, "alerts" | "extensions"> = {
    alerts: [],
    extensions: {},
  },
) {
  const start = new Date(Date.now() + 3_600_000);
  start.setUTCMinutes(0, 0, 0);
  const temperatures = [
    28, 27, 26, 26, 25, 24, 23, 23, 22, 21, 22, 24, 26, 28, 30, 31, 32, 32, 31,
    30, 29, 28, 27, 26,
  ];
  const rain = [
    3, 4, 5, 25, 60, 85, 100, 55, 20, 4, 0, 0, 0, 0, 0, 0, 0, 5, 10, 20, 30, 20,
    10, 0,
  ];
  const locations = WEATHER_LOCATIONS.map((location) => {
    const snapshot: WeatherSnapshot = {
      location: {
        key: location.key,
        name: location.name,
        adcode: location.amapAdcode,
      },
      fetchedAt: new Date().toISOString(),
      providers: ["amap", "open-meteo"],
      current: {
        source: "amap",
        observedAt: new Date().toISOString(),
        temperature: currentTemperature,
        humidity: 63,
        windDirection: "东北",
        windSpeed: 3,
        condition: { text: "多云", icon: "wmo-2" },
      },
      hourly: temperatures.map((temperature, index) => ({
        at: new Date(start.getTime() + index * 3_600_000).toISOString(),
        temperature,
        condition: {
          text: rain[index] >= 50 ? "阵雨" : "多云",
          icon: rain[index] >= 50 ? "wmo-80" : "wmo-2",
        },
        precipitationProbability: rain[index],
        precipitationAmount: rain[index] >= 50 ? 1.2 : 0,
      })),
      daily: [26, 27, 29, 25].map((high, index) => ({
        date: new Date(start.getTime() + index * 86_400_000).toISOString(),
        temperatureHigh: high,
        temperatureLow: 20,
        condition: { text: "多云", icon: "wmo-2" },
      })),
      alerts: observations.alerts,
      extensions: observations.extensions,
    };
    return { locationKey: location.key, snapshot };
  });

  await gotoAndWaitForReady(page, "/");
  const locale =
    (await page.locator("html").getAttribute("lang"))?.toLowerCase() === "en-us"
      ? "en-us"
      : "zh-cn";
  const messages = locale === "en-us" ? enUsMessages : zhCnMessages;
  const weatherCopy = messages.weather;
  const socialMetadata = buildSocialMetadata({
    canonicalPath: "/catalog/weather",
    origin: new URL(page.url()).origin,
    locale,
    title: `${weatherCopy.title} - Life@USTC`,
    description: weatherCopy.description,
    imageAlt: messages.metadata.social.imageAlt,
  });
  // The root layout is already loaded. Supply only the weather page's data
  // node; chart interaction tests must not wait for real weather providers.
  // The separate page contract tests exercise the real server load.
  await page.route("**/catalog/weather/__data.json*", async (route) => {
    await route.fulfill({
      json: {
        type: "data",
        nodes: [
          { type: "skip" },
          {
            type: "data",
            data: JSON.parse(
              stringify({
                copy: { weather: weatherCopy },
                locale,
                locations,
                socialMetadata,
              }),
            ),
            uses: { parent: 1 },
          },
        ],
      },
    });
  });
  // Scope the click to the shell navigation. The anonymous landing page links
  // to /catalog/weather from its own campus-weather card too, and on mobile the
  // open sidebar sheet covers that in-page link, so a document-wide `.first()`
  // can match an element that never becomes clickable. On mobile the sidebar
  // renders as a Sheet dialog; `app-sidebar` is a DOM node only on desktop.
  const mobile = (page.viewportSize()?.width ?? 1280) < 768;
  const navigation = mobile
    ? page.getByRole("dialog", { name: "Sidebar", exact: true })
    : appSidebar(page);
  if (mobile) {
    await page.locator('[data-slot="sidebar-trigger"]').click();
    await expect(navigation).toBeVisible();
  }
  await navigation.locator('a[href="/catalog/weather"]').first().click();
  await expect(
    page.locator('[data-testid="weather-hourly-chart"]:visible'),
  ).toHaveCount((page.viewportSize()?.width ?? 1280) < 768 ? 1 : 2);
  return locations[0].snapshot;
}
