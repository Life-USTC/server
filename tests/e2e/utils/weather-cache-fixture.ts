import { type APIRequestContext, expect } from "@playwright/test";
import type {
  WeatherLocationKey,
  WeatherSnapshot,
} from "../../../src/features/weather/server/weather-types";

const headers = { "x-test-storage-secret": "local-test-storage-observer" };
const path = (key: WeatherLocationKey) =>
  `/__test/storage/weather?locationKey=${key}`;

/** Read the real private Worker's WEATHER namespace, without a second runtime. */
export async function readWeatherCache(
  request: APIRequestContext,
  locationKey: WeatherLocationKey,
): Promise<WeatherSnapshot> {
  const response = await request.get(path(locationKey), { headers });
  expect(response.status()).toBe(200);
  return await response.json();
}

/** Explicit consumer inputs; no provider response or production merge is used. */
export async function arrangeWeatherCache(
  request: APIRequestContext,
): Promise<WeatherSnapshot[]> {
  const fetchedAt = new Date().toISOString();
  const snapshots: WeatherSnapshot[] = [
    {
      location: { key: "ustc-main", name: "本部", adcode: "340100" },
      fetchedAt,
      providers: ["open-meteo"],
      current: {
        temperature: 21,
        humidity: 45,
        condition: { text: "晴", icon: "wmo-0" },
      },
      hourly: [],
      daily: [],
      alerts: [],
      extensions: {},
    },
    {
      location: { key: "ustc-gaoxin", name: "高新校区", adcode: "340104" },
      fetchedAt,
      providers: ["open-meteo"],
      current: {
        temperature: 17,
        humidity: 60,
        condition: { text: "多云", icon: "wmo-2" },
      },
      hourly: [],
      daily: [],
      alerts: [],
      extensions: {},
    },
  ];
  // Fresh for the production 15-minute window; empty forecast series stay
  // identical when a consumer crosses an hour or midnight during the test.
  for (const snapshot of snapshots) {
    const response = await request.put(path(snapshot.location.key), {
      headers,
      data: snapshot,
    });
    expect(response.status()).toBe(204);
    await response.body();
    expect(await readWeatherCache(request, snapshot.location.key)).toEqual(
      snapshot,
    );
  }
  return snapshots;
}
