import {
  type APIRequestContext,
  expect,
  request as nativeRequest,
} from "@playwright/test";
import type {
  WeatherLocationKey,
  WeatherSnapshot,
} from "../../../src/features/weather/server/weather-types";

const headers = { "x-test-storage-secret": "local-test-storage-observer" };
const path = (key: WeatherLocationKey) =>
  `/__test/storage/weather?locationKey=${key}`;

/** Setup and later observations must not share connections across browser work. */
async function withWeatherCache<T>(
  origin: string,
  observe: (request: APIRequestContext) => Promise<T>,
): Promise<T> {
  const request = await nativeRequest.newContext({ baseURL: origin });
  let result: { value: T } | { error: unknown };
  try {
    result = { value: await observe(request) };
  } catch (error) {
    result = { error };
  }
  try {
    await request.dispose();
  } catch (error) {
    if ("error" in result)
      throw new AggregateError(
        [result.error, error],
        "Weather cache observation and disposal failed",
      );
    throw error;
  }
  if ("error" in result) throw result.error;
  return result.value;
}

async function readSnapshot(
  request: APIRequestContext,
  locationKey: WeatherLocationKey,
): Promise<WeatherSnapshot> {
  const response = await request.get(path(locationKey), { headers });
  expect(response.status()).toBe(200);
  return await response.json();
}

/** Read the real private Worker's WEATHER namespace, without a second runtime. */
export async function readWeatherCache(
  origin: string,
  locationKey: WeatherLocationKey,
): Promise<WeatherSnapshot> {
  return withWeatherCache(origin, (request) =>
    readSnapshot(request, locationKey),
  );
}

/** Explicit consumer inputs; no provider response or production merge is used. */
export async function arrangeWeatherCache(
  origin: string,
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
  await withWeatherCache(origin, async (request) => {
    for (const snapshot of snapshots) {
      const response = await request.put(path(snapshot.location.key), {
        headers,
        data: snapshot,
      });
      expect(response.status()).toBe(204);
      await response.body();
      expect(await readSnapshot(request, snapshot.location.key)).toEqual(
        snapshot,
      );
    }
  });
  return snapshots;
}
