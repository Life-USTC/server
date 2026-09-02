import { loadYoungEventsPage } from "@/features/young/server/young-page-load";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const [data, layoutData] = await Promise.all([
    loadYoungEventsPage({
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
            ? "CAMPUS · 第二课堂"
            : "SECOND CLASSROOM",
      },
      description: data.copy.youngEvents.description,
      title: `${data.copy.youngEvents.title} - Life@USTC`,
    }),
  };
};
