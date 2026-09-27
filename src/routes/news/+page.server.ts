import { loadPublicationListPage } from "@/features/publications/server/publication-page-load";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const layoutData = await event.parent();
  const data = await loadPublicationListPage(event.url, event.locals.locale);
  return {
    ...data,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      description: data.copy.pageDescription,
      title: `${data.copy.pageTitle} - Life@USTC`,
    }),
  };
};
