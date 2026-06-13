import type {
  DashboardPageCopy,
  DashboardPublicCounts,
} from "@/features/dashboard/server/dashboard-page-load-types";
import type { DashboardLinkSummary } from "@/features/home/server/dashboard-link-data";

export async function loadAnonymousDashboardPageData(input: {
  counts: DashboardPublicCounts;
  locale: string;
  overviewLinks: DashboardLinkSummary[];
  pageCopy: DashboardPageCopy;
  publicLinks: DashboardLinkSummary[];
  tab: string;
}) {
  return {
    copy: input.pageCopy,
    locale: input.locale,
    signedIn: false,
    tab: input.tab,
    counts: input.counts,
    publicLinks: input.publicLinks,
    overviewLinks: input.overviewLinks,
    bus: null,
  };
}
