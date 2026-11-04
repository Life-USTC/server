import { getCourseListPage } from "@/features/catalog/server/public-page-list-data";
import { getDemoCourseListPage } from "@/features/demo/server/demo-course-list";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, parent, url }) => {
  const [data, layoutData] = await Promise.all([
    locals.demo
      ? getDemoCourseListPage(url, locals.locale)
      : getCourseListPage(url, locals.locale),
    parent(),
  ]);

  return {
    ...data,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      description: data.labels.courses.subtitle,
      title: `${data.labels.common.courses} - Life@USTC`,
    }),
  };
};
