import {
  getPublicCatalogLinksData,
  getSignedInCatalogLinksData,
} from "@/features/catalog-links/server/catalog-link-data";
import { getWorkspacePageCopy } from "@/features/workspace/server/workspace-page-copy";
import type { WorkspacePageLoadEvent } from "@/features/workspace/server/workspace-page-load-types";
import { getWorkspaceUserId } from "@/features/workspace/server/workspace-page-server";

export async function loadPublicLinksPage({
  locals,
  request,
}: WorkspacePageLoadEvent) {
  const userId = await getWorkspaceUserId(request);
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
