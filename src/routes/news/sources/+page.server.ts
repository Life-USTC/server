import { getDemoNewsSources } from "@/features/demo/server/demo-news";
import {
  getDemoCopy,
  getDemoView,
} from "@/features/demo/server/demo-workspace";
import { getPublicationPageCopy } from "@/features/publications/server/publication-page-copy";
import { listPublicationSourceDirectory } from "@/features/publications/server/publication-source-directory-service";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const [layoutData, directory] = await Promise.all([
    event.parent(),
    event.locals.demo
      ? getDemoNewsSources(event.locals.locale)
      : listPublicationSourceDirectory(),
  ]);
  const copy = getPublicationPageCopy(event.locals.locale);
  const common = getWorkspacePageCopy(event.locals.locale).common;

  return {
    directory,
    newsSampleNotice: event.locals.demo
      ? getDemoCopy(event.locals.locale).newsSamples
      : null,
    newsExternalUnavailable: event.locals.demo
      ? getDemoCopy(event.locals.locale).newsExternalUnavailable
      : null,
    demo: event.locals.demo
      ? getDemoView(event.locals.demo, event.locals.locale)
      : null,
    copy,
    tableFilterLabels: common.tableFilters,
    applyFiltersLabel: common.applyFilters,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      description: copy.sourcesPageDescription,
      title: `${copy.sourcesPageTitle} - Life@USTC`,
    }),
  };
};
