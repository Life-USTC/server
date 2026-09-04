import { loadPublicLinksPage } from "@/features/workspace/server/public-links-page-load";
import { updateSocialMetadata } from "@/lib/social-metadata";
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
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      card: {
        label:
          event.locals.locale === "zh-cn"
            ? "CAMPUS · 校园链接"
            : "CAMPUS LINKS",
      },
      description: data.copy.dashboard.nav.links.description,
      title: `${data.copy.dashboard.nav.links.title} - Life@USTC`,
    }),
  };
};
