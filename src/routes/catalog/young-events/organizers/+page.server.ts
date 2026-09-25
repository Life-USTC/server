import { loadYoungOrganizersPage } from "@/features/young/server/young-page-load";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const [data, layoutData] = await Promise.all([
    loadYoungOrganizersPage({
      locals: event.locals,
      request: event.request,
      url: event.url,
    }),
    event.parent(),
  ]);

  return {
    ...data,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      description: data.copy.youngEvents.organizersDescription,
      title: `${data.copy.youngEvents.organizersTitle} - Life@USTC`,
    }),
  };
};
