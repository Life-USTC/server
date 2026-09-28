<script lang="ts">
import type {
  YoungEventSummary,
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { YoungEventsPageFilters } from "@/features/young/server/young-page-load";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { page as appPage } from "$app/stores";
import CollectionPage from "$lib/components/CollectionPage.svelte";
import ListPagination from "$lib/components/ListPagination.svelte";
import ResultsEmpty from "$lib/components/ResultsEmpty.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import {
  groupYoungEventsByStartDate,
  youngClockTime,
  youngListDayLabel,
  youngMonthDay,
} from "../lib/young-event-display";
import { youngDetailHref } from "../lib/young-navigation";
import YoungEventFilters from "./YoungEventFilters.svelte";
import YoungSourceNote from "./YoungSourceNote.svelte";

type Props = {
  categories: string[];
  copy: AppPageCopy;
  data: YoungEventSummary[];
  filters: YoungEventsPageFilters;
  organizers: Pick<YoungOrganizerSummary, "id" | "name">[];
  source: YoungSourceFreshness;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

let { categories, copy, data, filters, organizers, pagination, source }: Props =
  $props();

const youngCopy = $derived(copy.youngEvents);
const commonLabels = $derived(copy.common);

function pageHref(targetPage: number) {
  const params = new URLSearchParams($appPage.url.searchParams);
  params.set("page", String(targetPage));
  return `${$appPage.url.pathname}?${params}`;
}

const descriptionParts = $derived(
  youngCopy.description.split(youngCopy.platformName),
);
const locale = $derived($appPage.data.locale === "en-us" ? "en-us" : "zh-cn");
const groups = $derived(groupYoungEventsByStartDate(data));

function rowMeta(event: (typeof data)[number]) {
  const deadline =
    event.requiresSignup === false
      ? youngCopy.signupNotRequired
      : event.applyEndAt
        ? `${youngCopy.signupDeadline} ${[youngMonthDay(event.applyEndAt), youngClockTime(event.applyEndAt)].filter(Boolean).join(" ")}`
        : null;
  return [
    event.location,
    event.isOnline === true ? youngCopy.online : null,
    event.module,
    event.activityLevel,
    event.hours != null ? `${event.hours} ${youngCopy.hours}` : null,
    deadline,
  ]
    .filter(Boolean)
    .join(" · ");
}
</script>

{#snippet paginationFooter()}
  <div class="grid w-full gap-3">
    {#if pagination.totalPages > 1}
      <ListPagination
        ariaLabel={commonLabels.pagination}
        class="py-0"
        nextLabel={commonLabels.next}
        nextPageLabel={commonLabels.nextPage}
        page={pagination.page}
        {pageHref}
        previousLabel={commonLabels.previous}
        previousPageLabel={commonLabels.previousPage}
        totalPages={pagination.totalPages}
      />
    {/if}
    <YoungSourceNote labels={youngCopy} {source} />
  </div>
{/snippet}

{#snippet description()}
  <p class="mt-1 max-w-2xl text-muted-foreground [overflow-wrap:anywhere]">
    {#each descriptionParts as part, index (index)}
      {part}{#if index < descriptionParts.length - 1}<a class="underline underline-offset-4" href="https://young.ustc.edu.cn" rel="noreferrer noopener" target="_blank">{youngCopy.platformName}</a>{/if}
    {/each}
  </p>
{/snippet}

<CollectionPage footer={paginationFooter} title={youngCopy.title}>
  {#snippet belowTitle()}
    {@render description()}
  {/snippet}
  {#snippet toolbar()}
      <YoungEventFilters {copy} {filters} {organizers} {categories} />
  {/snippet}
    <section class="grid min-w-0 gap-3">
      {#if data.length > 0}
        <div class="grid gap-6">
          {#each groups as group (group.key || "unknown")}
            <section class="grid gap-1">
              <h2 class="text-sm font-medium text-muted-foreground">
                {youngListDayLabel(group.key, locale, youngCopy.unknownTime)}
              </h2>
              <ul class="divide-y">
                {#each group.events as event (event.youngId)}
                  <li>
                    <a
                      class="grid grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-3 hover:bg-muted/40 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]"
                      href={youngDetailHref(event.youngId, $appPage.url)}
                    >
                      <time class="pt-0.5 text-sm tabular-nums text-muted-foreground">
                        {youngClockTime(event.startAt) ?? "–"}
                      </time>
                      <span class="min-w-0">
                        <span class="block font-medium [overflow-wrap:anywhere]">{event.name}</span>
                        <span class="mt-0.5 block truncate text-sm text-muted-foreground">{rowMeta(event)}</span>
                        {#if event.sourceMissing}
                          <span class="mt-0.5 block text-xs text-muted-foreground">{youngCopy.sourceMissing}</span>
                        {/if}
                      </span>
                      <Badge class="col-start-2 w-fit sm:col-start-auto sm:justify-self-end" variant={event.isActive ? "default" : "outline"}>
                        {event.status ?? (event.isActive ? youngCopy.statusActive : youngCopy.statusEnded)}
                      </Badge>
                    </a>
                  </li>
                {/each}
              </ul>
            </section>
          {/each}
        </div>
      {:else}
        <div class="py-10">
          <ResultsEmpty
            description={youngCopy.description}
            title={youngCopy.noEventsFound}
          />
        </div>
      {/if}
    </section>
</CollectionPage>
