import { getDemoYoungOrganizersPage } from "@/features/demo/server/demo-young-page";
import { loadYoungOrganizersPage } from "@/features/young/server/young-page-load";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const [data, layoutData] = await Promise.all([
    event.locals.demo
      ? getDemoYoungOrganizersPage(
          event.locals.demo,
          event.locals.locale,
          event.url,
        )
      : loadYoungOrganizersPage({
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
