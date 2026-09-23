import { error } from "@sveltejs/kit";
import { loadYoungEventDetailPage } from "@/features/young/server/young-page-load";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const [data, layoutData] = await Promise.all([
    loadYoungEventDetailPage({
      locals: event.locals,
      request: event.request,
      url: event.url,
      youngId: event.params.youngId,
    }),
    event.parent(),
  ]);

  if (data.event == null) {
    error(404, data.copy.youngEvents.notFound);
  }

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
      title: `${data.event.name} - Life@USTC`,
    }),
  };
};
