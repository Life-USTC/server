import { error } from "@sveltejs/kit";
import {
  DEMO_REFERENCE_NOW,
  type DemoIdentity,
} from "@/features/demo/lib/demo-types";
import {
  normalizeYoungCalendarDate,
  type YoungCalendarView,
  youngCalendarRange,
} from "@/features/young/lib/young-calendar";
import { parseYoungTableFilters } from "@/features/young/server/young-table-filter-schema";
import type { AppLocale } from "@/i18n/config";
import {
  optionalValue,
  parsePositivePage,
  toLoadData,
} from "@/lib/load-data-utils";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { getDemoCalendarEvents } from "./demo-calendar-events";
import { getDemoCopy, getDemoView } from "./demo-workspace";
import {
  getDemoYoungCalendar,
  getDemoYoungEvent,
  getDemoYoungEvents,
  getDemoYoungOrganizer,
  getDemoYoungOrganizerOptions,
  getDemoYoungOrganizers,
  getDemoYoungSource,
  getDemoYoungSubscriptionFacts,
} from "./demo-young";

const active = (value: string | null) =>
  value === "true" ? true : value === "false" ? false : undefined;
const basis = (value: string | null) =>
  value === "registration" ? ("registration" as const) : ("activity" as const);
function common(identity: DemoIdentity, locale: AppLocale) {
  return {
    copy: getWorkspacePageCopy(locale),
    locale,
    demo: getDemoView(identity, locale),
    youngSampleNotice: getDemoCopy(locale).youngSamples,
    youngSubscriptionFactsLabel: getDemoCopy(locale).youngSubscriptionFacts,
  };
}
function table(url: URL, kind: "events" | "organizers") {
  try {
    return parseYoungTableFilters(url.searchParams, kind);
  } catch {
    error(400, "Invalid table filters");
  }
}
function filters(url: URL) {
  const params = url.searchParams;
  return {
    search: optionalValue(params.get("search")),
    module: optionalValue(params.get("module")),
    activityLevel: optionalValue(params.get("activityLevel")),
    active: active(params.get("active")),
    category: optionalValue(params.get("category")),
    organizerId: optionalValue(params.get("organizerId")),
    timeBasis: basis(params.get("timeBasis")),
  };
}
export function getDemoYoungEventsPage(
  identity: DemoIdentity,
  locale: AppLocale,
  url: URL,
) {
  const shared = common(identity, locale),
    selected = {
      ...filters(url),
      dateUnknown: active(url.searchParams.get("dateUnknown")),
    },
    tableFilters = table(url, "events");
  const result = getDemoYoungEvents(locale, {
    ...selected,
    tableFilters,
    tableStatusLabels: {
      statusOpen: shared.copy.youngEvents.statusActive,
      statusClosed: shared.copy.youngEvents.statusEnded,
    },
    page: parsePositivePage(url.searchParams.get("page")),
    pageSize: 20,
  });
  return toLoadData({
    ...shared,
    ...result,
    filters: selected,
    tableFilters,
    categories: [
      ...new Set(
        getDemoYoungEvents(locale, { pageSize: 100 })
          .data.map((event) => event.category)
          .filter((category): category is string => category != null),
      ),
    ].sort(),
    organizers: getDemoYoungOrganizerOptions(locale),
  });
}
export function getDemoYoungCalendarPage(
  identity: DemoIdentity,
  locale: AppLocale,
  url: URL,
) {
  const selected = filters(url);
  const requestedView = url.searchParams.get("view"),
    view: YoungCalendarView =
      requestedView === "day" || requestedView === "week"
        ? requestedView
        : "month";
  const requestedDate = url.searchParams.get("date");
  const validDate =
    requestedDate &&
    /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    Number.isFinite(Date.parse(requestedDate)) &&
    new Date(requestedDate).toISOString().startsWith(requestedDate);
  const anchorDate = normalizeYoungCalendarDate(
    validDate ? requestedDate : DEMO_REFERENCE_NOW.slice(0, 10),
  );
  const range = youngCalendarRange(view, anchorDate);
  return toLoadData({
    ...common(identity, locale),
    view,
    anchorDate,
    range,
    filters: selected,
    demoCalendarItems: getDemoCalendarEvents(locale),
    ...getDemoYoungCalendar(locale, {
      ...selected,
      dateFrom: range.start,
      dateTo: range.end,
    }),
  });
}
export function getDemoYoungOrganizersPage(
  identity: DemoIdentity,
  locale: AppLocale,
  url: URL,
) {
  const search = optionalValue(url.searchParams.get("search")),
    tableFilters = table(url, "organizers");
  return toLoadData({
    ...common(identity, locale),
    ...getDemoYoungOrganizers(locale, {
      page: parsePositivePage(url.searchParams.get("page")),
      pageSize: 20,
      activeFirst: true,
      search,
      tableFilters,
    }),
    search,
    tableFilters,
    source: getDemoYoungSource(),
  });
}
export function getDemoYoungOrganizerPage(
  identity: DemoIdentity,
  locale: AppLocale,
  url: URL,
  id: string,
) {
  return toLoadData({
    ...common(identity, locale),
    organizer: getDemoYoungOrganizer(locale, id),
    subscriptionState: getDemoYoungSubscriptionFacts("organizers", id),
    events: getDemoYoungEvents(locale, {
      organizerId: id,
      page: parsePositivePage(url.searchParams.get("page")),
      pageSize: 20,
    }),
    source: getDemoYoungSource(),
  });
}
export function getDemoYoungEventPage(
  identity: DemoIdentity,
  locale: AppLocale,
  id: string,
) {
  return toLoadData({
    ...common(identity, locale),
    event: getDemoYoungEvent(locale, id),
    subscriptionState: getDemoYoungSubscriptionFacts("events", id),
    commentsData: null,
    source: getDemoYoungSource(),
  });
}
