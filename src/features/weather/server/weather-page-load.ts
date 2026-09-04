import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import type { AppPageLoadEvent } from "@/lib/shell/page-load-types";
import { getWeatherSnapshot } from "./weather-service";
import {
  WEATHER_LOCATIONS,
  type WeatherLocationKey,
  type WeatherSnapshot,
} from "./weather-types";

export type WeatherPageLocation = {
  locationKey: WeatherLocationKey;
  snapshot: WeatherSnapshot | null;
};

export async function loadWeatherPage({ locals }: AppPageLoadEvent) {
  const locations = await Promise.all(
    WEATHER_LOCATIONS.map(
      async (location): Promise<WeatherPageLocation> => ({
        locationKey: location.key,
        snapshot: await getWeatherSnapshot(location.key),
      }),
    ),
  );

  return {
    copy: getWorkspacePageCopy(locals.locale),
    locale: locals.locale,
    locations,
  };
}
