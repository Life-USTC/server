import { pinyin } from "pinyin-pro";
import type { CatalogLinkItem } from "@/features/catalog-links/lib/catalog-links";
import {
  CATALOG_LINK_GROUP_ORDER,
  type CatalogLinkGroup,
} from "@/features/catalog-links/lib/catalog-links";

export type CatalogLinkSearchable = {
  description: string;
  descriptionPinyin: string;
  group: CatalogLinkGroup;
  title: string;
  titlePinyin: string;
  url: string;
};

export function searchQueryToTokens(query: string) {
  return query
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
}

export function linkMatchesTokens(
  link: CatalogLinkSearchable,
  tokens: string[],
) {
  const title = link.title.toLowerCase();
  const description = link.description.toLowerCase();
  const url = link.url.toLowerCase();
  return tokens.every(
    (token) =>
      title.includes(token) ||
      description.includes(token) ||
      url.includes(token) ||
      link.titlePinyin.includes(token) ||
      link.descriptionPinyin.includes(token),
  );
}

function toSearchPinyin(text: string) {
  if (!text.trim()) return "";
  return pinyin(text, { toneType: "none" }).replace(/\s+/g, "").toLowerCase();
}

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

export function catalogLinkItemMatchesTokens(
  link: CatalogLinkItem,
  tokens: string[],
) {
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

export function groupCatalogLinks<Link extends CatalogLinkSearchable>(
  links: Link[],
  query: string,
  labels: Record<CatalogLinkGroup, string>,
) {
  const tokens = searchQueryToTokens(query);
  const visibleLinks =
    tokens.length === 0
      ? links
      : links.filter((link) => linkMatchesTokens(link, tokens));

  return CATALOG_LINK_GROUP_ORDER.map((group) => ({
    group,
    label: labels[group],
    links: visibleLinks.filter((link) => link.group === group),
  })).filter((entry) => entry.links.length > 0);
}
