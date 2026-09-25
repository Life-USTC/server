import { getPublicCatalogLinksData } from "@/features/catalog-links/server/catalog-link-data";
import { getWorkspacePageCopy } from "@/features/workspace/server/workspace-page-copy";
import type { WorkspacePageLoadEvent } from "@/features/workspace/server/workspace-page-load-types";

export async function loadPublicLinksPage({ locals }: WorkspacePageLoadEvent) {
  const links = getPublicCatalogLinksData(locals.locale);

  return {
    copy: getWorkspacePageCopy(locals.locale),
    locale: locals.locale,
    links: links.catalogLinks,
    signedIn: false,
  };
}
