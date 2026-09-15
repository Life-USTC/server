import { loadPublicBusPage } from "@/features/workspace/server/public-bus-page-load";
import { updateSocialMetadata } from "@/lib/social-metadata";
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
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      card: {
        label: event.locals.locale === "zh-cn" ? "CAMPUS · 校车" : "CAMPUS BUS",
      },
      description: data.copy.workspace.nav.bus.description,
      title: `${data.copy.workspace.nav.bus.title} - Life@USTC`,
    }),
  };
};
