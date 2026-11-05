import { getSectionListPage } from "@/features/catalog/server/public-page-list-data";
import { getDemoSectionListPage } from "@/features/demo/server/demo-section-list";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, parent, url }) => {
  const [data, layoutData] = await Promise.all([
    locals.demo
      ? getDemoSectionListPage(url, locals.locale)
      : getSectionListPage(url, locals.locale),
    parent(),
  ]);

  return {
    ...data,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      description: data.labels.sections.subtitle,
      title: `${data.labels.common.sections} - Life@USTC`,
    }),
  };
};
