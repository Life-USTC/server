import { loadYoungCalendarPage } from "@/features/young/server/young-page-load";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const [data, layoutData] = await Promise.all([
    loadYoungCalendarPage({
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
            ? "CATALOG · 活动日历"
            : "SECOND CLASSROOM CALENDAR",
      },
      description: data.copy.youngEvents.calendarDescription,
      title: `${data.copy.youngEvents.calendarTitle} - Life@USTC`,
    }),
  };
};
