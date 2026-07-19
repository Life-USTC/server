import { loadPublicLinksPage } from "@/features/dashboard/server/public-links-page-load";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const [data, layoutData] = await Promise.all([
    loadPublicLinksPage({
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
      description: data.copy.dashboard.nav.links.description,
      title: `${data.copy.dashboard.nav.links.title} - Life@USTC`,
    },
  };
};
