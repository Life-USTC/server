import type { DashboardLinkSummary } from "@/features/home/server/dashboard-link-data";
import type { AppLocale } from "@/i18n/config";
import type { AppSession } from "@/lib/auth/session";
import type { getDashboardPageCopy } from "./dashboard-page-copy";

export type DashboardPageCopy = ReturnType<typeof getDashboardPageCopy>;

export type DashboardPublicCounts = {
  courses: number;
  sections: number;
  semesters: number;
};

export type DashboardPageLoadEvent = {
  locals: {
    authUser?: AppSession["user"] | null;
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
