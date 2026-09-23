import { getPublicationPageCopy } from "@/features/publications/server/publication-page-copy";
import { listPublicationSourceDirectory } from "@/features/publications/server/publication-source-directory-service";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const [layoutData, directory] = await Promise.all([
    event.parent(),
    listPublicationSourceDirectory(),
  ]);
  const copy = getPublicationPageCopy(event.locals.locale);

  return {
    directory,
    copy,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      description: copy.sourcesPageDescription,
      title: `${copy.sourcesPageTitle} - Life@USTC`,
    }),
  };
};
