import { loadPublicLinksPage } from "@/features/catalog-links/server/public-links-page-load";
import { getDemoCatalogLinksData } from "@/features/demo/server/demo-links";
import {
  getDemoCopy,
  getDemoView,
} from "@/features/demo/server/demo-workspace";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { updateSocialMetadata } from "@/lib/social-metadata";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const [data, layoutData] = await Promise.all([
    event.locals.demo
      ? {
          copy: getWorkspacePageCopy(event.locals.locale),
          locale: event.locals.locale,
          links: getDemoCatalogLinksData(event.locals.locale).catalogLinks,
          signedIn: false,
        }
      : loadPublicLinksPage({
          locals: event.locals,
          request: event.request,
          url: event.url,
        }),
    event.parent(),
  ]);

  return {
    ...data,
    linksSampleNotice: event.locals.demo
      ? getDemoCopy(event.locals.locale).linksSamples
      : null,
    demo: event.locals.demo
      ? getDemoView(event.locals.demo, event.locals.locale)
      : null,
    socialMetadata: updateSocialMetadata(layoutData.socialMetadata, {
      description: data.copy.workspace.nav.links.description,
      title: `${data.copy.workspace.nav.links.title} - Life@USTC`,
    }),
  };
};
