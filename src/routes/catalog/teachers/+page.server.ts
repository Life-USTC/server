import { getTeacherListPage } from "@/features/catalog/server/public-page-list-data";
import { getDemoTeacherListPage } from "@/features/demo/server/demo-teacher-list";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, parent, url }) => {
  const [data, layoutData] = await Promise.all([
    locals.demo
      ? getDemoTeacherListPage(url, locals.locale)
      : getTeacherListPage(url, locals.locale),
    parent(),
  ]);

  return {
    ...data,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      description: data.labels.teachers.subtitle,
      title: `${data.labels.common.teachers} - Life@USTC`,
    }),
  };
};
