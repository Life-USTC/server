import {
  localizeCatalogLinks,
  recommendCatalogLinks,
  USTC_CATALOG_LINKS,
} from "@/features/catalog-links/lib/catalog-links";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { toCatalogLinkSummary } from "./catalog-link-summary";

export function buildCatalogLinkSummaries(
  clickStats: Record<string, number>,
  pinnedSlugSet: Set<string>,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const catalogLinks = localizeCatalogLinks(USTC_CATALOG_LINKS, locale).map(
    (link) => toCatalogLinkSummary(link, clickStats, pinnedSlugSet),
  );

  return {
    catalogLinks,
    catalogLinkBySlug: new Map(
      catalogLinks.map((link) => [link.slug, link] as const),
    ),
  };
}

export function catalogLinksForSlugs<Link>(
  slugs: string[],
  catalogLinkBySlug: Map<string, Link>,
) {
  return slugs.flatMap((slug) => {
    const link = catalogLinkBySlug.get(slug);
    return link ? [link] : [];
  });
}

export function recommendedCatalogLinkSummaries(
  clickStats: Record<string, number>,
  pinnedSlugSet: Set<string>,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return recommendCatalogLinks(clickStats, {
    locale,
    limit: USTC_CATALOG_LINKS.length,
    excludeSlugs: Array.from(pinnedSlugSet),
  }).map((link) => toCatalogLinkSummary(link, clickStats, pinnedSlugSet));
}
