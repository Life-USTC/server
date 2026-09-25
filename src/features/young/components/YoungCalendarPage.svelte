<script lang="ts">
import YoungCalendar from "@/features/young/components/YoungCalendar.svelte";
import {
  fetchPersonalCalendar,
  PersonalCalendarRequestError,
} from "@/features/young/lib/personal-calendar-client";
import { youngCalendarConflicts } from "@/features/young/lib/young-calendar-conflicts";
import type {
  YoungEventSummary,
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { YoungCalendarPageFilters } from "@/features/young/server/young-page-load";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { getClientShellBootstrap } from "@/lib/shell/shell-bootstrap";
import { page } from "$app/stores";
import PageHeader from "$lib/components/PageHeader.svelte";
import PageLayout from "$lib/components/PageLayout.svelte";
import Panel from "$lib/components/Panel.svelte";
import ResultsSummary from "$lib/components/ResultsSummary.svelte";
import { youngDetailHref } from "../lib/young-navigation";
import YoungBrowseNav from "./YoungBrowseNav.svelte";
import YoungEventFilters from "./YoungEventFilters.svelte";

type Props = {
  anchorDate: string;
  categories: string[];
  copy: AppPageCopy;
  data: YoungEventSummary[];
  filters: YoungCalendarPageFilters;
  locale: string;
  organizers: Pick<YoungOrganizerSummary, "id" | "name">[];
  range: { start: string; end: string };
  source: YoungSourceFreshness;
  unknownDateCount: number;
  view: "day" | "week" | "month";
};

let {
  anchorDate,
  categories,
  copy,
  data,
  filters,
  locale,
  organizers,
  range,
  source,
  unknownDateCount,
  view,
}: Props = $props();

const youngCopy = $derived(copy.youngEvents);
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
  void getClientShellBootstrap(fetch, controller.signal)
    .then(({ viewer }) => {
      if (!viewer) throw new PersonalCalendarRequestError(401);
      return fetchPersonalCalendar(
        currentRange.start,
        currentRange.end,
        controller.signal,
      );
    })
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

function formatSourceDate(value: string | null) {
  return value ? value.slice(0, 16).replace("T", " ") : "-";
}

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
  empty: youngCopy.calendarEmpty,
  month: youngCopy.month,
  next: youngCopy.next,
  previous: youngCopy.previous,
  sourceMissing: youngCopy.sourceMissing,
  today: youngCopy.today,
  unknownDates: youngCopy.unknownDates,
  week: youngCopy.week,
});
</script>

<PageLayout>
  {#snippet header()}<PageHeader title={youngCopy.calendarTitle} description={youngCopy.calendarDescription} />{/snippet}
  <YoungBrowseNav current="calendar" copy={youngCopy} />
  <div class="flex flex-wrap items-center justify-between gap-3 text-sm" data-testid="young-source-freshness">
    <span class="text-muted-foreground">
      {#if source.status === "fresh"}
        {youngCopy.sourceFresh}
      {:else if source.status === "stale"}
        {youngCopy.sourceStale}
      {:else}
        {youngCopy.sourceUnknown}
      {/if}
      {#if source.lastSyncedAt} · {formatSourceDate(source.lastSyncedAt)}{/if}
    </span>

  </div>

  <Panel>
    {#snippet header()}
      <YoungEventFilters {copy} {filters} {organizers} {categories} calendar={{ view, date: anchorDate }} />
    {/snippet}

    <div class="grid gap-3">
    <ResultsSummary summary={youngCopy.showing.replace("{count}", String(data.length)).replace("{total}", String(data.length))} />
    {#if filters.timeBasis === "activity"}
      <p class="text-sm text-muted-foreground" aria-live="polite" data-testid="young-calendar-conflict-status">
        {#if conflictStatus === "loading"}{youngCopy.conflictLoading}
        {:else if conflictStatus === "signin"}<a class="underline" href={`/account/sign-in?callbackUrl=${encodeURIComponent(calendarHref(view, anchorDate))}`}>{youngCopy.conflictSignin}</a>
        {:else if conflictStatus === "failed"}{youngCopy.conflictUnavailable}
        {:else}{youngCopy.conflictScope}{/if}
      </p>
    {/if}
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
    </div>
  </Panel>
</PageLayout>
