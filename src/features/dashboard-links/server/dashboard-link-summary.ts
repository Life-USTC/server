import { pinyin } from "pinyin-pro";
import type {
  DashboardLinkGroup,
  DashboardLinkIcon,
} from "@/features/dashboard-links/lib/dashboard-links";
import {
  getDashboardLinkGroup,
  type USTC_DASHBOARD_LINKS,
} from "@/features/dashboard-links/lib/dashboard-links";

/** Lowercase pinyin (no tones, no spaces) for client-side search and IME. */
function toSearchPinyin(text: string): string {
  if (!text.trim()) return "";
  return pinyin(text, { toneType: "none" }).replace(/\s+/g, "").toLowerCase();
}

export type DashboardLinkSummary = {
  slug: string;
  title: string;
  url: string;
  description: string;
  /** Pinyin of title for search (lowercase, no spaces). */
  titlePinyin: string;
  /** Pinyin of description for search (lowercase, no spaces). */
  descriptionPinyin: string;
  icon: DashboardLinkIcon;
  group: DashboardLinkGroup;
  isPinned: boolean;
  clickCount: number;
};

export type DashboardLinksData = {
  dashboardLinks: DashboardLinkSummary[];
  recommendedLinks: DashboardLinkSummary[];
  pinnedLinks: DashboardLinkSummary[];
  overviewLinks: DashboardLinkSummary[];
};

export function toDashboardLinkSummary(
  link: (typeof USTC_DASHBOARD_LINKS)[number],
  clickStats: Record<string, number>,
  pinnedSlugSet: Set<string>,
): DashboardLinkSummary {
  return {
    ...link,
    titlePinyin: toSearchPinyin(link.title),
    descriptionPinyin: toSearchPinyin(link.description),
    group: getDashboardLinkGroup(link.slug),
    isPinned: pinnedSlugSet.has(link.slug),
    clickCount: clickStats[link.slug] ?? 0,
  };
}
