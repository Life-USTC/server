import { getCourseListPage } from "@/features/catalog/server/public-page-list-data";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, parent, url }) => {
  const [data, layoutData] = await Promise.all([
    getCourseListPage(url, locals.locale),
    parent(),
  ]);

  return {
    ...data,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      card: {
        footer: `Life@USTC · ${data.labels.common.courses}`,
        label: locals.locale === "zh-cn" ? "CATALOG · 课程" : "COURSE CATALOG",
      },
      description: data.labels.courses.subtitle,
      title: `${data.labels.common.courses} - Life@USTC`,
    }),
  };
};
