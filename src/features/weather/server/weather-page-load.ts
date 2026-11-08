import type { DemoIdentity } from "@/features/demo/lib/demo-types";
import { getDemoWeatherSnapshot } from "@/features/demo/server/demo-weather";
import {
  getDemoCopy,
  getDemoView,
} from "@/features/demo/server/demo-workspace";
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

export async function loadWeatherPage({
  locals,
}: AppPageLoadEvent & { locals: { demo?: DemoIdentity | null } }) {
  const locations = await Promise.all(
    WEATHER_LOCATIONS.map(
      async (location): Promise<WeatherPageLocation> => ({
        locationKey: location.key,
        snapshot: locals.demo
          ? getDemoWeatherSnapshot(location.key, locals.locale)
          : await getWeatherSnapshot(location.key),
      }),
    ),
  );

  return {
    sampleNotice: locals.demo ? getDemoCopy(locals.locale).campusSamples : null,
    demo: locals.demo ? getDemoView(locals.demo, locals.locale) : null,
    copy: getWorkspacePageCopy(locals.locale),
    locale: locals.locale,
    locations,
  };
}
