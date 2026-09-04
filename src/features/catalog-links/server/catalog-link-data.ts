import { CATALOG_LINK_GROUPS } from "@/features/catalog-links/lib/catalog-links";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { withUserDbContext } from "@/lib/db/prisma";
import {
  buildCatalogLinkSummaries,
  catalogLinksForSlugs,
  recommendedCatalogLinkSummaries,
} from "./catalog-link-selection";
import type {
  CatalogLinkSummary,
  CatalogLinksData,
} from "./catalog-link-summary";

const MAX_OVERVIEW_LINKS = 4;

export type { CatalogLinkSummary, CatalogLinksData };

export function getPublicCatalogLinksData(locale: AppLocale = DEFAULT_LOCALE): {
  catalogLinks: CatalogLinkSummary[];
  overviewLinks: CatalogLinkSummary[];
} {
  const emptyClickStats: Record<string, number> = {};
  const emptyPinnedSet = new Set<string>();
  const { catalogLinks, catalogLinkBySlug } = buildCatalogLinkSummaries(
    emptyClickStats,
    emptyPinnedSet,
    locale,
  );
  const overviewLinks = catalogLinksForSlugs(
    CATALOG_LINK_GROUPS.mostClicked.slice(0, MAX_OVERVIEW_LINKS),
    catalogLinkBySlug,
  );

  return {
    catalogLinks,
    overviewLinks,
  };
}

export async function getSignedInCatalogLinksData(
  userId: string,
  locale: AppLocale = DEFAULT_LOCALE,
): Promise<CatalogLinksData> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error("Catalog link user ID is required");
  return withUserDbContext(normalizedUserId, async (tx) => {
    const clickRows = await tx.catalogLinkClick.findMany({
      where: { userId: normalizedUserId },
      select: { slug: true, count: true },
    });
    const pinRows = await tx.workspaceLinkPin.findMany({
      where: { userId: normalizedUserId },
      select: { slug: true },
      orderBy: { createdAt: "asc" },
    });
    const clickStats: Record<string, number> = Object.fromEntries(
      clickRows.map((row) => [row.slug, row.count]),
    );
    const pinnedSlugSet = new Set(pinRows.map((row) => row.slug));

    const { catalogLinks, catalogLinkBySlug } = buildCatalogLinkSummaries(
      clickStats,
      pinnedSlugSet,
      locale,
    );
    const pinnedLinks = catalogLinksForSlugs(
      pinRows.map((row) => row.slug),
      catalogLinkBySlug,
    );
    const recommendedLinks = recommendedCatalogLinkSummaries(
      clickStats,
      pinnedSlugSet,
      locale,
    );
    const overviewLinks = [...pinnedLinks, ...recommendedLinks].slice(
      0,
      MAX_OVERVIEW_LINKS,
    );

    return {
      catalogLinks,
      recommendedLinks,
      pinnedLinks,
      overviewLinks,
    };
  });
}

export async function getLinksTabData(
  userId: string,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  return getSignedInCatalogLinksData(userId, locale);
}
