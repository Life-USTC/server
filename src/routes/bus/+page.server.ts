import { loadPublicBusPage } from "@/features/dashboard/server/public-bus-page-load";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const [data, layoutData] = await Promise.all([
    loadPublicBusPage({
      locals: event.locals,
      request: event.request,
      url: event.url,
    }),
    event.parent(),
  ]);

  return {
    ...data,
    socialMetadata: {
      ...layoutData.socialMetadata,
      description: data.copy.dashboard.nav.bus.description,
      title: `${data.copy.dashboard.nav.bus.title} - Life@USTC`,
    },
  };
};
