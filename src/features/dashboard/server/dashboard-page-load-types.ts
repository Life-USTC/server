import type { DashboardLinkSummary } from "@/features/home/server/dashboard-link-data";
import type { getDashboardPageCopy } from "./dashboard-page-copy";

export type DashboardPageCopy = ReturnType<typeof getDashboardPageCopy>;

export type DashboardPublicCounts = {
  courses: number;
  sections: number;
  semesters: number;
};

export type DashboardPageLoadEvent = {
  locals: {
    locale: string;
  };
  request: Request;
  url: URL;
};

export type DashboardPublicLinks = {
  dashboardLinks: DashboardLinkSummary[];
  overviewLinks: DashboardLinkSummary[];
};
