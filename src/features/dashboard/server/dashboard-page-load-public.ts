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
  const bus =
    input.tab === "bus"
      ? await import("@/features/bus/lib/bus-service").then((mod) =>
          mod.getBusTimetableData({
            locale: input.locale === "en-us" ? "en-us" : "zh-cn",
            userId: null,
          }),
        )
      : null;

  return {
    copy: input.pageCopy,
    locale: input.locale,
    signedIn: false,
    tab: input.tab,
    counts: input.counts,
    publicLinks: input.publicLinks,
    overviewLinks: input.overviewLinks,
    bus,
  };
}
