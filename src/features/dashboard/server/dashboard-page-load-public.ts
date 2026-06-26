import type {
  DashboardPageCopy,
  DashboardPublicCounts,
} from "@/features/dashboard/server/dashboard-page-load-types";
import { getBusTabData } from "@/features/dashboard/server/dashboard-tab-data";
import type { DashboardLinkSummary } from "@/features/dashboard-links/server/dashboard-link-data";
import type { AppLocale } from "@/i18n/config";

export async function loadAnonymousDashboardPageData(input: {
  counts: DashboardPublicCounts;
  locale: AppLocale;
  overviewLinks: DashboardLinkSummary[];
  pageCopy: DashboardPageCopy;
  publicLinks: DashboardLinkSummary[];
  tab: string;
}) {
  const bus =
    input.tab === "bus" ? await getBusTabData(null, input.locale) : null;

  return {
    copy: input.pageCopy,
    locale: input.locale,
    signedIn: false,
    tab: input.tab,
    counts: input.counts,
    publicLinks: input.publicLinks,
    overviewLinks: input.overviewLinks,
    bus: bus?.data ?? null,
  };
}
