import { getPublicCatalogLinksData } from "@/features/catalog-links/server/catalog-link-data";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import type { AppPageLoadEvent } from "@/lib/shell/page-load-types";

export async function loadPublicLinksPage({ locals }: AppPageLoadEvent) {
  const links = getPublicCatalogLinksData(locals.locale);

  return {
    copy: getWorkspacePageCopy(locals.locale),
    locale: locals.locale,
    links: links.catalogLinks,
    signedIn: false,
  };
}
