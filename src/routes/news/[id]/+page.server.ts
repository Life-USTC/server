import { error } from "@sveltejs/kit";
import { getPublicationPageCopy } from "@/features/publications/server/publication-page-copy";
import { getPublicPublicationById } from "@/features/publications/server/publication-public-read-service";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const [layoutData, publication] = await Promise.all([
    event.parent(),
    getPublicPublicationById(event.params.id),
  ]);
  const copy = getPublicationPageCopy(event.locals.locale);
  if (!publication) {
    throw error(404, copy.notFoundDescription);
  }

  return {
    publication,
    copy,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      description: publication.revision.summary ?? copy.pageDescription,
      title: `${publication.revision.title} - ${copy.title}`,
    }),
  };
};
