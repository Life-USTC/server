import { redirect } from "@sveltejs/kit";
import { collapsePublicationListSearchParams } from "@/features/publications/lib/publication-read-request-schemas";
import { getPublicationPageCopy } from "@/features/publications/server/publication-page-copy";
import { listPublications } from "@/features/publications/server/publication-public-read-service";
import { listPublicationSourceOptions } from "@/features/publications/server/publication-source-directory-service";
import type { AppLocale } from "@/i18n/config";
import { publicationsQuerySchema } from "@/lib/api/schemas/request-schemas";

const FILTER_PARAMS = [
  "type",
  "source",
  "organizationLevel",
  "query",
  "fold",
] as const;

function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export async function loadPublicationListPage(url: URL, locale: AppLocale) {
  // The filter form posts its source and level checkboxes as repeated params;
  // collapsing them first lets the page and /api/publications share one schema.
  const searchParams = collapsePublicationListSearchParams(url.searchParams);
  const rawQuery = Object.fromEntries(
    FILTER_PARAMS.flatMap((key) => {
      const value = searchParams.get(key)?.trim();
      return value ? [[key, value]] : [];
    }),
  );
  const parsedQuery = publicationsQuerySchema.safeParse(rawQuery);
  const filters = parsedQuery.success ? parsedQuery.data : {};
  const requestedPage = parsePage(url.searchParams.get("page"));
  const [publications, sourceOptions] = await Promise.all([
    listPublications({
      filters,
      pagination: {
        page: requestedPage,
        pageSize: 20,
      },
    }),
    listPublicationSourceOptions(),
  ]);
  if (
    publications.pagination.totalPages > 0 &&
    requestedPage > publications.pagination.totalPages
  ) {
    const target = new URL(url);
    target.searchParams.set("page", String(publications.pagination.totalPages));
    redirect(307, `${target.pathname}${target.search}`);
  }
  const copy = getPublicationPageCopy(locale);

  return {
    publications,
    filters,
    sourceOptions,
    copy,
  };
}
