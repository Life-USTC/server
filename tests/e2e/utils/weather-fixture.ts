import { expect, type Page } from "@playwright/test";
import { stringify, unflatten } from "devalue";
import type { WeatherSnapshot } from "@/features/weather/server/weather-types";
import { WEATHER_LOCATIONS } from "@/features/weather/server/weather-types";
import { gotoAndWaitForReady } from "./page-ready";

export async function showWeatherFixture(page: Page) {
  const start = new Date(Date.now() + 3_600_000);
  start.setUTCMinutes(0, 0, 0);
  const temperatures = [28, 27, 26, 26, 25, 24, 23, 23, 22, 21, 22, 24];
  const rain = [3, 4, 5, 25, 60, 85, 100, 55, 20, 4, 0, 0];
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
        temperature: 24,
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
      alerts: [],
      extensions: {},
    };
    return { locationKey: location.key, snapshot };
  });

  await gotoAndWaitForReady(page, "/");
  // Replace the weather page read model only; keep real routing, shell, and components.
  await page.route("**/catalog/weather/__data.json*", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    let replaced = false;
    for (const node of payload.nodes ?? []) {
      if (node?.type !== "data" || !Array.isArray(node.data)) continue;
      const data = unflatten(node.data) as Record<string, unknown>;
      if (!("locations" in data)) continue;
      node.data = JSON.parse(stringify({ ...data, locations }));
      replaced = true;
    }
    expect(replaced).toBe(true);
    await route.fulfill({ response, json: payload });
  });
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await page.locator('[data-slot="sidebar-trigger"]').click();
  }
  await page.locator('a[href="/catalog/weather"]').first().click();
  await expect(page.getByTestId("weather-hourly-chart")).toHaveCount(2);
  return locations[0].snapshot;
}
