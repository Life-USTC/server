import { error, redirect } from "@sveltejs/kit";
import type { DemoIdentity } from "@/features/demo/lib/demo-types";
import { getPublicationPageCopy } from "@/features/publications/server/publication-page-copy";
import type { AppLocale } from "@/i18n/config";
import { getDemoNewsList, getDemoNewsSourceOptions } from "./demo-news";
import { parseDemoNewsQuery } from "./demo-news-query";
import { getDemoCopy, getDemoView } from "./demo-workspace";

export function getDemoNewsListPage(
  url: URL,
  identity: DemoIdentity,
  locale: AppLocale,
) {
  const parsed = parseDemoNewsQuery(url, true);
  if (!parsed.success) error(400, "Invalid demo publication query");
  const publications = getDemoNewsList(locale, {
    ...parsed.data,
    pageSize: 20,
  });
  if (!publications) error(404, "Demo publication source not found");
  if (publications.pagination.page > publications.pagination.totalPages) {
    const target = new URL(url);
    target.searchParams.set("page", String(publications.pagination.totalPages));
    redirect(307, `${target.pathname}${target.search}`);
  }
  const { page: _page, pageSize: _pageSize, ...filters } = parsed.data;
  return {
    demo: getDemoView(identity, locale),
    newsSampleNotice: getDemoCopy(locale).newsSamples,
    hasPublications: true,
    publications,
    filters,
    sourceOptions: getDemoNewsSourceOptions(locale),
    copy: getPublicationPageCopy(locale),
  };
}
