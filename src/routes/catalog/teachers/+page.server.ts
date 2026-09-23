import { getTeacherListPage } from "@/features/catalog/server/public-page-list-data";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, parent, url }) => {
  const [data, layoutData] = await Promise.all([
    getTeacherListPage(url, locals.locale),
    parent(),
  ]);

  return {
    ...data,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      card: {
        footer: `Life@USTC · ${data.labels.common.teachers}`,
        label: locals.locale === "zh-cn" ? "CATALOG · 教师" : "TEACHER CATALOG",
      },
      description: data.labels.teachers.subtitle,
      title: `${data.labels.common.teachers} - Life@USTC`,
    }),
  };
};
