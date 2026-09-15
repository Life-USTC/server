import { error } from "@sveltejs/kit";
import { loadYoungOrganizerDetailPage } from "@/features/young/server/young-page-load";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const [data, layoutData] = await Promise.all([
    loadYoungOrganizerDetailPage({
      locals: event.locals,
      request: event.request,
      url: event.url,
      organizerId: event.params.organizerId,
    }),
    event.parent(),
  ]);

  if (data.organizer == null) {
    error(404, data.copy.youngEvents.organizerNotFound);
  }

  return {
    ...data,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      card: {
        label:
          event.locals.locale === "zh-cn"
            ? "CATALOG · 主办方"
            : "SECOND CLASSROOM ORGANIZER",
      },
      description: data.copy.youngEvents.organizersDescription,
      title: `${data.organizer.name} - Life@USTC`,
    }),
  };
};
