import type {
  CatalogLinkGroup,
  CatalogLinkIcon,
} from "@/features/catalog-links/lib/catalog-links";
import {
  getCatalogLinkGroup,
  type LocalizedCatalogLinkItem,
} from "@/features/catalog-links/lib/catalog-links";
import { toSearchPinyin } from "./catalog-text-pinyin";

export type CatalogLinkSummary = {
  slug: string;
  title: string;
  url: string;
  description: string;
  /** Pinyin of title for search (lowercase, no spaces). */
  titlePinyin: string;
  /** Pinyin of description for search (lowercase, no spaces). */
  descriptionPinyin: string;
  icon: CatalogLinkIcon;
  group: CatalogLinkGroup;
  isPinned: boolean;
  clickCount: number;
};

export type CatalogLinksData = {
  catalogLinks: CatalogLinkSummary[];
  recommendedLinks: CatalogLinkSummary[];
  pinnedLinks: CatalogLinkSummary[];
  overviewLinks: CatalogLinkSummary[];
};

export function toCatalogLinkSummary(
  link: LocalizedCatalogLinkItem,
  clickStats: Record<string, number>,
  pinnedSlugSet: Set<string>,
): CatalogLinkSummary {
  return {
    ...link,
    titlePinyin: toSearchPinyin(link.title),
    descriptionPinyin: toSearchPinyin(link.description),
    group: getCatalogLinkGroup(link.slug),
    isPinned: pinnedSlugSet.has(link.slug),
    clickCount: clickStats[link.slug] ?? 0,
  };
}
