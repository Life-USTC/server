import type { CatalogLinkSummary } from "@/features/catalog-links/server/catalog-link-data";
import type { AppPageLoadEvent } from "@/lib/shell/page-load-types";
import type {
  getAnonymousHomePageCopy,
  getWorkspacePageCopy,
} from "@/lib/shell/page-copy";

export type { AppPageLoadEvent } from "@/lib/shell/page-load-types";
export type WorkspacePageCopy = ReturnType<typeof getWorkspacePageCopy>;
export type AnonymousHomePageCopy = ReturnType<typeof getAnonymousHomePageCopy>;
export type WorkspacePageLoadEvent = AppPageLoadEvent;

export type CatalogPublicLinks = {
  catalogLinks: CatalogLinkSummary[];
  overviewLinks: CatalogLinkSummary[];
};
