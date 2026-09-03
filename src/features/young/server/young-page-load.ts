import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import { getDashboardPageCopy } from "@/features/dashboard/server/dashboard-page-copy";
import type { DashboardPageLoadEvent } from "@/features/dashboard/server/dashboard-page-load-types";
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
}: DashboardPageLoadEvent) {
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
    copy: getDashboardPageCopy(locals.locale),
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
}: DashboardPageLoadEvent & { youngId: string }) {
  const event = await getYoungEvent(youngId);

  return toLoadData({
    copy: getDashboardPageCopy(locals.locale),
    locale: locals.locale,
    event,
  });
}
