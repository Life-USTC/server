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
      description: data.copy.workspace.nav.links.description,
      title: `${data.copy.workspace.nav.links.title} - Life@USTC`,
    }),
  };
};
