import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import type { AppPageLoadEvent } from "@/lib/shell/page-load-types";
import {
  getYoungEvent,
  listYoungEventCategories,
  listYoungEvents,
} from "@/features/young/server/young-event-service";
import {
  optionalValue,
  parsePositivePage,
  toLoadData,
} from "@/lib/load-data-utils";

export type YoungEventsPageFilters = {
  active?: boolean;
  category?: string;
  search?: string;
};

function parseActiveParam(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function loadYoungEventsPage({
  locals,
  url,
}: AppPageLoadEvent) {
  const filters: YoungEventsPageFilters = {
    active: parseActiveParam(url.searchParams.get("active")),
    category: optionalValue(url.searchParams.get("category")),
    search: optionalValue(url.searchParams.get("search")),
  };
  const page = parsePositivePage(url.searchParams.get("page"));

  const [result, categories] = await Promise.all([
    listYoungEvents({
      active: filters.active,
      category: filters.category,
      search: filters.search,
      page,
      pageSize: CATALOG_PAGE_SIZE,
    }),
    listYoungEventCategories(),
  ]);

  return toLoadData({
    copy: getWorkspacePageCopy(locals.locale),
    locale: locals.locale,
    data: result.data,
    pagination: result.pagination,
    filters,
    categories,
  });
}

export async function loadYoungEventDetailPage({
  locals,
  youngId,
}: AppPageLoadEvent & { youngId: string }) {
  const event = await getYoungEvent(youngId);

  return toLoadData({
    copy: getWorkspacePageCopy(locals.locale),
    locale: locals.locale,
    event,
  });
}
