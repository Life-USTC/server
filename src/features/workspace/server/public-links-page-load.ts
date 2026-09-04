import {
  getPublicCatalogLinksData,
  getSignedInCatalogLinksData,
} from "@/features/catalog-links/server/catalog-link-data";
import { getWorkspacePageCopy } from "@/features/workspace/server/dashboard-page-copy";
import type { DashboardPageLoadEvent } from "@/features/workspace/server/dashboard-page-load-types";
import { getDashboardUserId } from "@/features/workspace/server/dashboard-page-server";

export async function loadPublicLinksPage({
  locals,
  request,
}: DashboardPageLoadEvent) {
  const userId = await getDashboardUserId(request);
  const links = await (userId
    ? getSignedInCatalogLinksData(userId, locals.locale)
    : getPublicCatalogLinksData(locals.locale));

  return {
    copy: getWorkspacePageCopy(locals.locale),
    locale: locals.locale,
    links: links.catalogLinks,
    signedIn: Boolean(userId),
  };
}
