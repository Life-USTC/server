import {
  type CatalogLinkSearchable,
  linkMatchesTokens,
  searchQueryToTokens,
} from "@/features/catalog-links/lib/catalog-link-search";
import {
  type CatalogLinkItem,
  localizeCatalogLink,
  USTC_CATALOG_LINKS,
} from "@/features/catalog-links/lib/catalog-links";
import { toSearchPinyin } from "@/features/catalog-links/server/catalog-text-pinyin";
import type { AppLocale } from "@/i18n/config";

function toSearchableFields(
  title: string,
  description: string,
  url: string,
): CatalogLinkSearchable {
  return {
    title,
    description,
    url,
    titlePinyin: toSearchPinyin(title),
    descriptionPinyin: toSearchPinyin(description),
    group: "life",
  };
}

function catalogLinkItemMatchesTokens(link: CatalogLinkItem, tokens: string[]) {
  const localizedFields = [
    { title: link.title, description: link.description },
    link.localizations["en-us"],
  ];
  return localizedFields.some((fields) =>
    linkMatchesTokens(
      toSearchableFields(fields.title, fields.description, link.url),
      tokens,
    ),
  );
}

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
