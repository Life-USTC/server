import {
  catalogLinkItemMatchesTokens,
  searchQueryToTokens,
} from "@/features/catalog-links/lib/catalog-link-search";
import {
  localizeCatalogLink,
  USTC_CATALOG_LINKS,
} from "@/features/catalog-links/lib/catalog-links";
import type { AppLocale } from "@/i18n/config";

const MIN_QUERY_LENGTH = 2;

export function searchLinksForGlobal(
  query: string,
  locale: AppLocale,
  limit: number,
) {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const tokens = searchQueryToTokens(trimmed);
  if (tokens.length === 0) return [];

  return USTC_CATALOG_LINKS.filter((link) =>
    catalogLinkItemMatchesTokens(link, tokens),
  )
    .slice(0, limit)
    .map((link) => {
      const localized = localizeCatalogLink(link, locale);
      return {
        description: localized.description,
        slug: localized.slug,
        title: localized.title,
        url: localized.url,
      };
    });
}
