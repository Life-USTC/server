import { loadWeatherPage } from "@/features/weather/server/weather-page-load";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const [data, layoutData] = await Promise.all([
    loadWeatherPage({
      locals: event.locals,
      request: event.request,
      url: event.url,
    }),
    event.parent(),
  ]);

  return {
    ...data,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      description: data.copy.weather.description,
      title: `${data.copy.weather.title} - Life@USTC`,
    }),
  };
};
