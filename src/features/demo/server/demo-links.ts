import {
  buildCatalogLinkSummaries,
  catalogLinksForSlugs,
  recommendedCatalogLinkSummaries,
} from "@/features/catalog-links/server/catalog-link-selection";
import type { CatalogLinksData } from "@/features/catalog-links/server/catalog-link-summary";
import type { AppLocale } from "@/i18n/config";

/** Fictional personal preferences over the unchanged public website catalog. */
export function getDemoCatalogLinksData(locale: AppLocale): CatalogLinksData {
  const clicks = { jw: 12, library: 7, mail: 4, icourse: 2 };
  const pinnedSlugs = ["jw", "library"];
  const pins = new Set(pinnedSlugs);
  const { catalogLinks, catalogLinkBySlug } = buildCatalogLinkSummaries(
    clicks,
    pins,
    locale,
  );
  const pinnedLinks = catalogLinksForSlugs(pinnedSlugs, catalogLinkBySlug);
  const recommendedLinks = recommendedCatalogLinkSummaries(
    clicks,
    pins,
    locale,
  );
  return {
    catalogLinks,
    pinnedLinks,
    recommendedLinks,
    overviewLinks: [...pinnedLinks, ...recommendedLinks].slice(0, 4),
  };
}
