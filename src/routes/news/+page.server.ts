import { getDemoNewsListPage } from "@/features/demo/server/demo-news-page";
import { loadPublicationListPage } from "@/features/publications/server/publication-page-load";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const layoutData = await event.parent();
  const data = event.locals.demo
    ? getDemoNewsListPage(event.url, event.locals.demo, event.locals.locale)
    : await loadPublicationListPage(event.url, event.locals.locale);
  return {
    ...data,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      description: data.copy.pageDescription,
      title: `${data.copy.pageTitle} - Life@USTC`,
    }),
  };
};
