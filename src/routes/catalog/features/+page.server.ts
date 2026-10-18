import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent }) => {
  const { copy, socialMetadata } = await parent();
  return {
    socialMetadata: updateSocialMetadata(socialMetadata, {
      description: copy.nav.hub.description,
      title: `${copy.nav.hub.title} - Life@USTC`,
    }),
  };
};
