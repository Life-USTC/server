import type {
  PublicPublicationDetail,
  PublicPublicationList,
  PublicPublicationObject,
} from "@/features/publications/server/publication-public-read-service";

export type PublicationListFilters = {
  type?: "news" | "notice";
  source?: string;
  query?: string;
};

export type PublicationListPageData = {
  publications: PublicPublicationList;
  filters: PublicationListFilters;
};

export type PublicationDetailPageData = {
  publication: PublicPublicationDetail;
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
  sourceId: string;
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
};
