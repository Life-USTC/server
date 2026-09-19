import type { PublicationSourceOrganizationLevel } from "@/features/publications/lib/publication-source-levels";
import type {
  PublicPublicationDetail,
  PublicPublicationList,
  PublicPublicationObject,
} from "@/features/publications/server/publication-public-read-service";
import type {
  PublicPublicationSourceDirectory,
  PublicPublicationSourceSummary,
} from "@/features/publications/server/publication-source-directory-service";

export type PublicationListFilters = {
  type?: "news" | "notice";
  /** Selected source ids; named after the `source` query parameter. */
  source?: string[];
  /** Selected source organization levels. */
  organizationLevel?: PublicationSourceOrganizationLevel[];
  query?: string;
  fold?: boolean;
};

/** One selectable entry in the list page's source filter. */
export type PublicationSourceOption = {
  id: string;
  name: string;
  organizationLevel: PublicationSourceOrganizationLevel;
};

export type PublicationListPageData = {
  publications: PublicPublicationList;
  filters: PublicationListFilters;
  sourceOptions: PublicationSourceOption[];
};

export type PublicationSourceDirectoryPageData = {
  directory: PublicPublicationSourceDirectory;
};

export type PublicationSourceSummary = PublicPublicationSourceSummary;

export type PublicationDetailPageData = {
  publication: PublicPublicationDetail;
  renderedBodyHtml: string;
};

export type PublicationObject = PublicPublicationObject;

export type PublicationPageCopy = {
  title: string;
  pageTitle: string;
  pageDescription: string;
  news: string;
  notice: string;
  all: string;
  publicationType: string;
  headline: string;
  source: string;
  search: string;
  searchPlaceholder: string;
  applyFilters: string;
  clearFilters: string;
  resultsCount: string;
  emptyTitle: string;
  emptyDescription: string;
  publishedAt: string;
  updatedAt: string;
  readMore: string;
  sourcePage: string;
  backToList: string;
  attachments: string;
  media: string;
  openAttachment: string;
  noBody: string;
  notFoundTitle: string;
  notFoundDescription: string;
  missingDate: string;
  previousPage: string;
  nextPage: string;
  pagination: string;
  objectLabels: Record<string, string>;
  foldToggle: string;
  foldSiblingCount: string;
  alsoPublishedIn: string;
  sourcesTitle: string;
  sourcesPageTitle: string;
  sourcesPageDescription: string;
  sourcesTotals: string;
  sourcesEmptyTitle: string;
  sourcesEmptyDescription: string;
  sourcesGroupSummary: string;
  sourceArticleCount: string;
  lastPublishedAt: string;
  neverPublished: string;
  sourceHosts: string;
  viewSourceArticles: string;
  backToSources: string;
  organizationLevel: string;
  organizationLevelFilter: string;
  sourceFilter: string;
  sourceFilterHint: string;
  sourceFilterEmpty: string;
  organizationLevelLabels: Record<PublicationSourceOrganizationLevel, string>;
};
