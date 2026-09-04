import { getSignedInCatalogLinksData } from "@/features/catalog-links/server/catalog-link-data";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";

const EMPTY_WORKSPACE_OVERVIEW_LINKS = {
  catalogLinks: [],
  recommendedLinks: [],
  pinnedLinks: [],
  overviewLinks: [],
};

export function getWorkspaceOverviewLinksData(
  userId: string,
  {
    locale = DEFAULT_LOCALE,
    skipLinks,
  }: { locale?: AppLocale; skipLinks?: boolean },
) {
  if (skipLinks) {
    return Promise.resolve(EMPTY_WORKSPACE_OVERVIEW_LINKS);
  }
  return getSignedInCatalogLinksData(userId, locale);
}
