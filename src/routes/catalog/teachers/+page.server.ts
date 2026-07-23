import { getTeacherListPage } from "@/features/catalog/server/public-page-list-data";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, parent, url }) => {
  const [data, layoutData] = await Promise.all([
    getTeacherListPage(url, locals.locale),
    parent(),
  ]);

  return {
    ...data,
    socialMetadata: {
      ...layoutData.socialMetadata,
      description: data.labels.teachers.subtitle,
      title: `${data.labels.common.teachers} - Life@USTC`,
    },
  };
};
