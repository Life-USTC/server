import type { DashboardLinkSummary } from "@/features/dashboard-links/server/dashboard-link-data";
import type { AppLocale } from "@/i18n/config";
import type {
  getAnonymousHomePageCopy,
  getDashboardPageCopy,
} from "./dashboard-page-copy";

export type DashboardPageCopy = ReturnType<typeof getDashboardPageCopy>;
export type AnonymousHomePageCopy = ReturnType<typeof getAnonymousHomePageCopy>;

export type DashboardPageLoadEvent = {
  locals: {
    locale: AppLocale;
    requestId?: string;
  };
  request: Request;
  url: URL;
};

export type DashboardPublicLinks = {
  dashboardLinks: DashboardLinkSummary[];
  overviewLinks: DashboardLinkSummary[];
};
