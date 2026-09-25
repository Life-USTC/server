import { CATALOG_PAGE_SIZE } from "@/features/catalog/server/catalog-page-constants";
import {
  normalizeYoungCalendarDate,
  type YoungCalendarView,
  youngCalendarRange,
} from "@/features/young/lib/young-calendar";
import {
  getYoungEvent,
  getYoungOrganizer,
  getYoungSourceFreshness,
  listYoungEventCategories,
  listYoungEvents,
  listYoungOrganizers,
  type YoungEventPage,
  type YoungEventTimeBasis,
} from "@/features/young/server/young-event-service";
import {
  optionalValue,
  parsePositivePage,
  toLoadData,
} from "@/lib/load-data-utils";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import type { AppPageLoadEvent } from "@/lib/shell/page-load-types";
import { listYoungOrganizerOptions } from "./young-organizer-service";

export type YoungEventsPageFilters = {
  dateUnknown?: boolean;
  timeBasis?: YoungEventTimeBasis;
  active?: boolean;
  category?: string;
  module?: string;
  activityLevel?: string;
  search?: string;
  organizerId?: string;
};

export type YoungCalendarPageFilters = {
  search?: string;
  module?: string;
  activityLevel?: string;
  active?: boolean;
  category?: string;
  organizerId?: string;
  timeBasis: YoungEventTimeBasis;
};

function parseActiveParam(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function loadYoungEventsPage({ locals, url }: AppPageLoadEvent) {
  const filters: YoungEventsPageFilters = {
    dateUnknown: parseActiveParam(url.searchParams.get("dateUnknown")),
    timeBasis: parseTimeBasis(url.searchParams.get("timeBasis")),
    active: parseActiveParam(url.searchParams.get("active")),
    category: optionalValue(url.searchParams.get("category")),
    module: optionalValue(url.searchParams.get("module")),
    activityLevel: optionalValue(url.searchParams.get("activityLevel")),
    search: optionalValue(url.searchParams.get("search")),
    organizerId: optionalValue(url.searchParams.get("organizerId")),
  };
  const page = parsePositivePage(url.searchParams.get("page"));

  const [result, categories, organizers] = await Promise.all([
    listYoungEvents({
      active: filters.active,
      category: filters.category,
      module: filters.module,
      activityLevel: filters.activityLevel,
      search: filters.search,
      dateUnknown: filters.dateUnknown,
      timeBasis: filters.timeBasis,
      organizerId: filters.organizerId,
      page,
      pageSize: CATALOG_PAGE_SIZE,
    }),
    listYoungEventCategories(),
    listYoungOrganizerOptions(),
  ]);

  return toLoadData({
    copy: getWorkspacePageCopy(locals.locale),
    locale: locals.locale,
    data: result.data,
    pagination: result.pagination,
    filters,
    categories,
    organizers,
    source: result.source,
  });
}

function parseCalendarView(value: string | null): YoungCalendarView {
  return value === "day" || value === "week" || value === "month"
    ? value
    : "month";
}

function parseTimeBasis(value: string | null): YoungEventTimeBasis {
  return value === "registration" ? "registration" : "activity";
}

async function listAllYoungEventsForRange(input: {
  search?: string;
  module?: string;
  activityLevel?: string;
  active?: boolean;
  category?: string;
  organizerId?: string;
  dateFrom: string;
  dateTo: string;
  timeBasis: YoungEventTimeBasis;
}): Promise<YoungEventPage> {
  const pageSize = 100;
  const first = await listYoungEvents({ ...input, page: 1, pageSize });
  if (first.pagination.totalPages <= 1) return first;
  const pages: YoungEventPage[] = [];
  for (let page = 2; page <= first.pagination.totalPages; page++) {
    pages.push(await listYoungEvents({ ...input, page, pageSize }));
  }

  return {
    data: [first, ...pages].flatMap((page) => page.data),
    pagination: {
      page: 1,
      pageSize,
      total: first.pagination.total,
      totalPages: 1,
    },
    unknownDateCount: first.unknownDateCount,
    source: first.source,
  };
}

export async function loadYoungCalendarPage({ locals, url }: AppPageLoadEvent) {
  const view = parseCalendarView(url.searchParams.get("view"));
  const anchorDate = normalizeYoungCalendarDate(url.searchParams.get("date"));
  const range = youngCalendarRange(view, anchorDate);
  const filters: YoungCalendarPageFilters = {
    search: optionalValue(url.searchParams.get("search")),
    module: optionalValue(url.searchParams.get("module")),
    activityLevel: optionalValue(url.searchParams.get("activityLevel")),
    active: parseActiveParam(url.searchParams.get("active")),
    category: optionalValue(url.searchParams.get("category")),
    organizerId: optionalValue(url.searchParams.get("organizerId")),
    timeBasis: parseTimeBasis(url.searchParams.get("timeBasis")),
  };
  const [result, categories, organizers] = await Promise.all([
    listAllYoungEventsForRange({
      search: filters.search,
      module: filters.module,
      activityLevel: filters.activityLevel,
      active: filters.active,
      category: filters.category,
      organizerId: filters.organizerId,
      dateFrom: range.start,
      dateTo: range.end,
      timeBasis: filters.timeBasis,
    }),
    listYoungEventCategories(),
    listYoungOrganizerOptions(),
  ]);

  return toLoadData({
    copy: getWorkspacePageCopy(locals.locale),
    locale: locals.locale,
    view,
    anchorDate,
    range,
    filters,
    categories,
    organizers,
    data: result.data,
    unknownDateCount: result.unknownDateCount,
    source: result.source,
  });
}

export async function loadYoungOrganizersPage({
  locals,
  url,
}: AppPageLoadEvent) {
  const page = parsePositivePage(url.searchParams.get("page"));
  const search = optionalValue(url.searchParams.get("search"));
  const [result, source] = await Promise.all([
    listYoungOrganizers({
      activeFirst: true,
      search,
      page,
      pageSize: CATALOG_PAGE_SIZE,
    }),
    getYoungSourceFreshness(),
  ]);
  return toLoadData({
    copy: getWorkspacePageCopy(locals.locale),
    locale: locals.locale,
    data: result.data,
    pagination: result.pagination,
    search,
    source,
  });
}

export async function loadYoungOrganizerDetailPage({
  locals,
  url,
  organizerId,
}: AppPageLoadEvent & { organizerId: string }) {
  const [organizer, source, events] = await Promise.all([
    getYoungOrganizer(organizerId),
    getYoungSourceFreshness(),
    listYoungEvents({
      organizerId,
      page: parsePositivePage(url.searchParams.get("page")),
      pageSize: CATALOG_PAGE_SIZE,
    }),
  ]);
  return toLoadData({
    copy: getWorkspacePageCopy(locals.locale),
    locale: locals.locale,
    organizer,
    events,
    source,
  });
}

export async function loadYoungEventDetailPage({
  locals,
  youngId,
}: AppPageLoadEvent & { youngId: string }) {
  const [event, source] = await Promise.all([
    getYoungEvent(youngId),
    getYoungSourceFreshness(),
  ]);

  return toLoadData({
    copy: getWorkspacePageCopy(locals.locale),
    locale: locals.locale,
    event,
    commentsData: null,
    source,
  });
}
