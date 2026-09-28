<script lang="ts">
import YoungCalendar from "@/features/young/components/YoungCalendar.svelte";
import {
  fetchPersonalCalendar,
  PersonalCalendarRequestError,
} from "@/features/young/lib/personal-calendar-client";
import { youngCalendarConflicts } from "@/features/young/lib/young-calendar-conflicts";
import type {
  YoungEventSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { YoungCalendarPageFilters } from "@/features/young/server/young-page-load";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import { page } from "$app/stores";
import CollectionPage from "$lib/components/CollectionPage.svelte";
import { youngDetailHref } from "../lib/young-navigation";
import YoungSourceNote from "./YoungSourceNote.svelte";

type Props = {
  anchorDate: string;
  copy: AppPageCopy;
  data: YoungEventSummary[];
  filters: YoungCalendarPageFilters;
  locale: string;
  range: { start: string; end: string };
  source: YoungSourceFreshness;
  unknownDateCount: number;
  view: "day" | "week" | "month";
};

let {
  anchorDate,
  copy,
  data,
  filters,
  locale,
  range,
  source,
  unknownDateCount,
  view,
}: Props = $props();

const youngCopy = $derived(copy.youngEvents);
const shellViewer = getShellViewer();
const viewerId = $derived($shellViewer.viewer?.id ?? null);
const viewerStatus = $derived($shellViewer.status);
let conflictIds = $state<Set<string>>(new Set());
let conflictStatus = $state<"loading" | "ready" | "signin" | "failed">(
  "loading",
);
$effect(() => {
  const currentEvents = data;
  const currentRange = range;
  const basis = filters.timeBasis;
  const controller = new AbortController();
  conflictIds = new Set();
  if (basis !== "activity") return;
  conflictStatus = "loading";
  if (viewerStatus === "loading") return;
  if (viewerStatus === "error") {
    conflictStatus = "failed";
    return;
  }
  if (!viewerId) {
    conflictStatus = "signin";
    return;
  }
  void fetchPersonalCalendar(
    currentRange.start,
    currentRange.end,
    controller.signal,
  )
    .then((items) => {
      if (controller.signal.aborted) return;
      conflictIds = youngCalendarConflicts(currentEvents, items);
      conflictStatus = "ready";
    })
    .catch((error) => {
      if (controller.signal.aborted) return;
      conflictStatus =
        error instanceof PersonalCalendarRequestError && error.status === 401
          ? "signin"
          : "failed";
    });
  return () => controller.abort();
});

const calendarHref = $derived.by(() => {
  const currentFilters = filters;
  return function calendarHref(
    targetView: "day" | "week" | "month",
    date: string,
  ) {
    const params = new URLSearchParams({ view: targetView, date });
    for (const key of ["search", "module", "activityLevel"] as const) {
      if (currentFilters[key]) params.set(key, currentFilters[key]);
    }
    if (currentFilters.active != null)
      params.set("active", String(currentFilters.active));
    if (currentFilters.category)
      params.set("category", currentFilters.category);
    if (currentFilters.organizerId)
      params.set("organizerId", currentFilters.organizerId);
    if (currentFilters.timeBasis !== "activity")
      params.set("timeBasis", currentFilters.timeBasis);
    return `/catalog/young-events/calendar?${params.toString()}`;
  };
});

function unknownDatesHref() {
  const params = new URLSearchParams({
    dateUnknown: "true",
    timeBasis: filters.timeBasis,
  });
  for (const key of ["search", "module", "activityLevel"] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  if (filters.organizerId) params.set("organizerId", filters.organizerId);
  if (filters.category) params.set("category", filters.category);
  if (filters.active != null) params.set("active", String(filters.active));
  return `/catalog/young-events?${params}`;
}

const calendarLabels = $derived({
  agenda: youngCopy.agenda,
  earlierDates: youngCopy.earlierDates,
  day: youngCopy.day,
  month: youngCopy.month,
  moreEvents: youngCopy.moreEvents,
  next: youngCopy.next,
  previous: youngCopy.previous,
  sourceMissing: youngCopy.sourceMissing,
  today: youngCopy.today,
  unknownDates: youngCopy.unknownDates,
  week: youngCopy.week,
});
</script>

{#snippet calendarFooter()}
  <YoungSourceNote labels={youngCopy} {source} />
{/snippet}

<CollectionPage
  description={youngCopy.calendarDescription}
  footer={calendarFooter}
  title={youngCopy.calendarTitle}
>
    <div class="grid gap-3">
    <YoungCalendar
      {conflictIds}
      conflictLabel={youngCopy.workspace.conflict}
      {anchorDate}
      eventHref={(event) => youngDetailHref(event.youngId, $page.url)}
      events={data}
      hrefFor={calendarHref}
      labels={calendarLabels}
      {locale}
      timeBasis={filters.timeBasis}
      {unknownDateCount}
      unknownDatesHref={unknownDatesHref()}
      {view}
    />
    {#if filters.timeBasis === "activity"}
      <p class="text-right text-xs text-muted-foreground" aria-live="polite" data-testid="young-calendar-conflict-status">
        {#if conflictStatus === "loading"}{youngCopy.conflictLoading}
        {:else if conflictStatus === "signin"}<a class="underline" href={`/account/sign-in?callbackUrl=${encodeURIComponent(calendarHref(view, anchorDate))}`}>{youngCopy.conflictSignin}</a>
        {:else if conflictStatus === "failed"}{youngCopy.conflictUnavailable}
        {:else}{youngCopy.conflictScope}{/if}
      </p>
    {/if}
    </div>
</CollectionPage>
