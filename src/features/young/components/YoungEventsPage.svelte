<script lang="ts">
import type {
  YoungEventSummary,
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { YoungEventsPageFilters } from "@/features/young/server/young-page-load";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { page as appPage } from "$app/stores";
import ListPagination from "$lib/components/ListPagination.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import PageLayout from "$lib/components/PageLayout.svelte";
import Panel from "$lib/components/Panel.svelte";
import ResponsiveCollection from "$lib/components/ResponsiveCollection.svelte";
import ResultsEmpty from "$lib/components/ResultsEmpty.svelte";
import ResultsSummary from "$lib/components/ResultsSummary.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import {
  youngCapacity,
  youngDateRange,
  youngDateTime,
} from "../lib/young-event-display";
import { youngDetailHref } from "../lib/young-navigation";
import YoungBrowseNav from "./YoungBrowseNav.svelte";
import YoungEventFilters from "./YoungEventFilters.svelte";

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
function formatDateTime(value: string | null) {
  return youngDateTime(value) ?? youngCopy.unknownTime;
}

function pageHref(targetPage: number) {
  const params = new URLSearchParams($appPage.url.searchParams);
  params.set("page", String(targetPage));
  return `${$appPage.url.pathname}?${params}`;
}

const summary = $derived(
  youngCopy.showing
    .replace("{count}", String(data.length))
    .replace("{total}", String(pagination.total)),
);
</script>

{#snippet paginationFooter()}
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
{/snippet}

<PageLayout>
  {#snippet header()}<PageHeader title={youngCopy.title} description={youngCopy.description} />{/snippet}
  <YoungBrowseNav current="events" copy={youngCopy} />
  <div class="flex flex-wrap items-center justify-between gap-3 text-sm" data-testid="young-source-freshness">
    <span class="text-muted-foreground">
      {#if source.status === "fresh"}
        {youngCopy.sourceFresh}
      {:else if source.status === "stale"}
        {youngCopy.sourceStale}
      {:else}
        {youngCopy.sourceUnknown}
      {/if}
      {#if source.lastSyncedAt} · {formatDateTime(source.lastSyncedAt)}{/if}
    </span>

  </div>
  <Panel footer={pagination.totalPages > 1 ? paginationFooter : undefined}>
    {#snippet header()}
      <YoungEventFilters {copy} {filters} {organizers} {categories} />
    {/snippet}
    <section class="grid min-w-0 gap-3">
      <ResultsSummary
        {summary}
        page={pagination.page}
        totalPages={pagination.totalPages}
      />
      {#if data.length > 0}
        <ResponsiveCollection>
          {#snippet mobile()}
            <Item.Group class="gap-0" role="list">
              {#each data as event, index (event.youngId)}
                <div role="listitem">
                  <Item.Root size="sm">
                    {#snippet child({ props })}
                      <a href={youngDetailHref(event.youngId, $appPage.url)} {...props}>
                        <Item.Content>
                          <Item.Title>{event.name}</Item.Title>
                        </Item.Content>
                        <Item.Actions>
                          {formatDateTime(event.startAt)}
                        </Item.Actions>
                        <Item.Footer class="flex-wrap justify-start">
                          <Badge variant={event.isActive ? "default" : "outline"}>{event.status ?? (event.isActive ? youngCopy.statusActive : youngCopy.statusEnded)}</Badge>
                          {#each [...new Set([event.category, event.module, event.activityLevel].filter(Boolean))] as label (label)}
                            <Badge variant="secondary">{label}</Badge>
                          {/each}
                          {#if event.requiresSignup === false}<Badge variant="outline">{youngCopy.signupNotRequired}</Badge>{/if}
                          {#if event.isOnline === true}<Badge variant="outline">{youngCopy.online}</Badge>{/if}
                          {#if event.hours != null}<span>{youngCopy.hours}: {event.hours}</span>{/if}
                          {#if event.location}<span>{event.location}</span>{/if}
                          {#if event.applyEndAt && event.requiresSignup !== false}<span>{youngCopy.signupWindow}: {youngCopy.endsAt.replace("{value}", formatDateTime(event.applyEndAt))}</span>{/if}
                          {#if event.sourceMissing}<span>{youngCopy.sourceMissing}</span>{/if}
                        </Item.Footer>
                      </a>
                    {/snippet}
                  </Item.Root>
                  {#if index < data.length - 1}
                    <Item.Separator />
                  {/if}
                </div>
              {/each}
            </Item.Group>
          {/snippet}
          {#snippet desktop()}
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head class="w-2/5">{youngCopy.eventName}</Table.Head>
                  <Table.Head>{youngCopy.eventTime}</Table.Head>
                  <Table.Head>{youngCopy.signupWindow}</Table.Head>
                  <Table.Head>{youngCopy.capacity}</Table.Head>
                  <Table.Head>{youngCopy.status}</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each data as event (event.youngId)}
                  <Table.Row class="has-[a:hover]:bg-muted/50">
                    <Table.Cell class="p-0">
                      <a class="block px-3 py-3 underline-offset-4 hover:underline" href={youngDetailHref(event.youngId, $appPage.url)}>
                        <div class="grid gap-1">
                          <span class="whitespace-normal break-words font-medium">{event.name}</span>
                          <span class="text-xs text-muted-foreground">{[event.category, event.module, event.activityLevel].filter(Boolean).join(" · ")}</span>
                          {#if event.location || event.isOnline === true}
                            <span class="text-xs text-muted-foreground">{[event.location, event.isOnline === true ? youngCopy.online : null].filter(Boolean).join(" · ")}</span>
                          {/if}
                        </div>
                      </a>
                    </Table.Cell>
                    <Table.Cell class="whitespace-nowrap">
                      {formatDateTime(event.startAt)}
                    </Table.Cell>
                    <Table.Cell>
                      {event.requiresSignup === false ? youngCopy.signupNotRequired : youngDateRange(event.applyStartAt, event.applyEndAt, youngCopy) ?? youngCopy.unknownTime}
                    </Table.Cell>
                    <Table.Cell class="tabular-nums">
                      {youngCapacity(event.appliedCount, event.capacity, youngCopy.unknownValue)}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={event.isActive ? "default" : "outline"}>{event.status ?? (event.isActive ? youngCopy.statusActive : youngCopy.statusEnded)}</Badge>
                      {#if event.sourceMissing}
                        <div class="text-muted-foreground text-xs">{youngCopy.sourceMissing}</div>
                      {/if}
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          {/snippet}
        </ResponsiveCollection>
      {:else}
        <div class="py-10">
          <ResultsEmpty
            description={youngCopy.description}
            title={youngCopy.noEventsFound}
          />
        </div>
      {/if}
    </section>
  </Panel>
</PageLayout>
