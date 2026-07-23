import { getPublicDashboardLinksData } from "@/features/dashboard-links/server/dashboard-link-data";
import { jsonResponse } from "@/lib/api/helpers";
import { resolvePublicCatalogLocale } from "@/lib/api/routes/request-locale";

export function getCatalogLinksRoute(request: Request) {
  const localeResolution = resolvePublicCatalogLocale(request);
  if (localeResolution instanceof Response) return localeResolution;

  return jsonResponse(
    {
      links: getPublicDashboardLinksData(
        localeResolution.locale,
      ).dashboardLinks.map(({ clickCount: _, isPinned: __, ...link }) => link),
    },
    {
      headers: localeResolution.cacheHeaders,
    },
  );
}
