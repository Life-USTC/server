import type { CatalogLinkSummary } from "@/features/catalog-links/server/catalog-link-data";
import type { AppLocale } from "@/i18n/config";
import type {
  getAnonymousHomePageCopy,
  getWorkspacePageCopy,
} from "./dashboard-page-copy";

export type WorkspacePageCopy = ReturnType<typeof getWorkspacePageCopy>;
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
  catalogLinks: CatalogLinkSummary[];
  overviewLinks: CatalogLinkSummary[];
};
