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
import PageLayout from "$lib/components/PageLayout.svelte";
import Panel from "$lib/components/Panel.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";

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
const commonLabels = $derived(copy.common);
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

function listHref() {
  const params = new URLSearchParams();
  if (filters.active != null) params.set("active", String(filters.active));
  if (filters.category) params.set("category", filters.category);
  if (filters.organizerId) params.set("organizerId", filters.organizerId);
  return params.size > 0
    ? `/catalog/young-events?${params.toString()}`
    : "/catalog/young-events";
}

function unknownDatesHref() {
  const params = new URLSearchParams({
    dateUnknown: "true",
    timeBasis: filters.timeBasis,
  });
  if (filters.organizerId) params.set("organizerId", filters.organizerId);
  if (filters.category) params.set("category", filters.category);
  if (filters.active != null) params.set("active", String(filters.active));
  return `/catalog/young-events?${params}`;
}

function clearHref() {
  return `/catalog/young-events/calendar?view=${view}&date=${anchorDate}`;
}

const calendarLabels = $derived({
  agenda: youngCopy.agenda,
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

<PageLayout description={youngCopy.calendarDescription} title={youngCopy.calendarTitle} width="full">
  <div class="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm" data-testid="young-source-freshness">
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
    <div class="flex flex-wrap gap-2">
      <Button href={listHref()} variant="outline">{youngCopy.title}</Button>
      <Button href="/catalog/young-events/organizers" variant="outline">{youngCopy.viewOrganizers}</Button>
    </div>
  </div>

  <Panel>
    {#snippet header()}
      <form
        action="/catalog/young-events/calendar"
        class="flex flex-wrap items-end gap-3"
        method="get"
      >
        <input name="view" type="hidden" value={view} />
        <input name="date" type="hidden" value={anchorDate} />
        <div class="grid gap-1.5">
          <label class="text-sm font-medium" for="young-calendar-active">
            {youngCopy.signupStatus}
          </label>
          <NativeSelect.Root
            id="young-calendar-active"
            name="active"
            value={filters.active == null ? "" : String(filters.active)}
          >
            <NativeSelect.Option value="">{youngCopy.statusAll}</NativeSelect.Option>
            <NativeSelect.Option value="true">{youngCopy.statusActive}</NativeSelect.Option>
            <NativeSelect.Option value="false">{youngCopy.statusEnded}</NativeSelect.Option>
          </NativeSelect.Root>
        </div>
        <div class="grid gap-1.5">
          <label class="text-sm font-medium" for="young-calendar-category">
            {youngCopy.category}
          </label>
          <NativeSelect.Root
            id="young-calendar-category"
            name="category"
            value={filters.category ?? ""}
          >
            <NativeSelect.Option value="">{youngCopy.allCategories}</NativeSelect.Option>
            {#each categories as category (category)}
              <NativeSelect.Option value={category}>{category}</NativeSelect.Option>
            {/each}
          </NativeSelect.Root>
        </div>
        <div class="grid gap-1.5">
          <label class="text-sm font-medium" for="young-calendar-organizer">
            {youngCopy.organizerFilter}
          </label>
          <NativeSelect.Root
            id="young-calendar-organizer"
            name="organizerId"
            value={filters.organizerId ?? ""}
          >
            <NativeSelect.Option value="">{youngCopy.allOrganizers}</NativeSelect.Option>
            {#each organizers as organizer (organizer.id)}
              <NativeSelect.Option value={organizer.id}>{organizer.name}</NativeSelect.Option>
            {/each}
          </NativeSelect.Root>
        </div>
        <div class="grid gap-1.5">
          <label class="text-sm font-medium" for="young-calendar-time-basis">
            {youngCopy.eventTime}
          </label>
          <NativeSelect.Root
            id="young-calendar-time-basis"
            name="timeBasis"
            value={filters.timeBasis}
          >
            <NativeSelect.Option value="activity">{youngCopy.eventTime}</NativeSelect.Option>
            <NativeSelect.Option value="registration">{youngCopy.signupWindow}</NativeSelect.Option>
          </NativeSelect.Root>
        </div>
        <Button type="submit">{commonLabels.search}</Button>
        <Button href={clearHref()} variant="outline">{commonLabels.clear}</Button>
      </form>
    {/snippet}

    {#if filters.timeBasis === "activity"}
      <p class="mb-3 text-sm text-muted-foreground" aria-live="polite" data-testid="young-calendar-conflict-status">
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
      eventHref={(event) => `/catalog/young-events/${event.youngId}`}
      events={data}
      hrefFor={calendarHref}
      labels={calendarLabels}
      {locale}
      timeBasis={filters.timeBasis}
      {unknownDateCount}
      unknownDatesHref={unknownDatesHref()}
      {view}
    />
  </Panel>
</PageLayout>
