<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import ListPagination from "#lib/components/ListPagination.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import ResultsSummary from "#lib/components/ResultsSummary.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import { resolveStatusToken } from "#lib/ui/action-status-tokens.js";
import { catalogShowingSummary } from "@/features/catalog/lib/catalog-results-summary";
import type {
  YoungEventSummary,
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { YoungEventsPageFilters } from "@/features/young/server/young-page-load";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { page as appPage } from "$app/state";
import {
  groupYoungEventsByStartDate,
  youngCapacity,
  youngEventStatusLabel,
  youngListDayLabel,
  youngListTimeLabel,
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
  const params = new URLSearchParams(appPage.url.search);
  params.set("page", String(targetPage));
  return `${appPage.url.pathname}?${params}`;
}

const descriptionParts = $derived(
  youngCopy.description.split(youngCopy.platformName),
);
const locale = $derived(appPage.data.locale === "en-us" ? "en-us" : "zh-cn");
const groups = $derived(groupYoungEventsByStartDate(data));
const summary = $derived(
  catalogShowingSummary(
    pagination.total === 1 ? youngCopy.showingOne : youngCopy.showing,
    data.length,
    pagination.total,
  ),
);

function listTime(event: YoungEventSummary) {
  return youngListTimeLabel(event.startAt, event.isActive, youngCopy);
}

function listStatus(event: YoungEventSummary) {
  return youngEventStatusLabel(event, youngCopy);
}
</script>

{#snippet metaBadges(event: YoungEventSummary)}
  <div class="mt-1 flex min-w-0 flex-wrap items-center gap-1.5" data-testid="young-list-metadata">
    {#each [event.category, event.module, event.activityLevel] as value}
      {#if value?.trim()}
        <Badge variant="outline" class="h-auto max-w-full whitespace-normal [overflow-wrap:anywhere]">{value}</Badge>
      {/if}
    {/each}
    {#if event.organizer}
      <span class="text-xs text-muted-foreground [overflow-wrap:anywhere]">{event.organizer}</span>
    {/if}
  </div>
{/snippet}

{#snippet statusBadge(event: YoungEventSummary)}
  <Badge
    data-status-token={resolveStatusToken({
      status: event.status,
      isActive: event.isActive,
    })}
    variant={`status-${resolveStatusToken(event)}`}
  >
    {listStatus(event)}
  </Badge>
{/snippet}

{#snippet paginationFooter()}
  <div class="grid w-full gap-3">
    {#if pagination.totalPages > 1}
      <ListPagination
        ariaLabel={commonLabels.pagination}
        class="py-0"
        nextLabel={commonLabels.next}
        nextPageLabel={commonLabels.nextPage}
        page={pagination.page}
        pageHref={pageHref}
        previousLabel={commonLabels.previous}
        previousPageLabel={commonLabels.previousPage}
        totalPages={pagination.totalPages}
      />
    {/if}
    <YoungSourceNote labels={youngCopy} source={source} />
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
    <YoungEventFilters
      copy={copy}
      filters={filters}
      organizers={organizers}
      categories={categories}
    />
  {/snippet}
  <section class="grid min-w-0 gap-3">
    <ResultsSummary
      summary={summary}
      page={pagination.page}
      totalPages={pagination.totalPages}
    />

    {#if data.length > 0}
      <ResponsiveCollection>
        {#snippet mobile()}
          <div class="grid gap-6">
            {#each groups as group (group.key || "unknown")}
              <section class="grid gap-1">
                  <h2 class="text-sm font-medium text-muted-foreground">
                    {youngListDayLabel(group.key, locale, youngCopy.unknownTime)}
                  </h2>
                <Item.Group class="gap-0" role="list">
                  {#each group.events as event (event.youngId)}
                    <div role="listitem">
                      <MobileListCard size="sm">
                        {#snippet child({ props })}
                          <a href={youngDetailHref(event.youngId)} {...props}>
                            <Item.Content class="min-w-0 basis-full [overflow-wrap:anywhere]">
                              <Item.Title>{event.name}</Item.Title>
                              <p class="text-sm leading-normal text-muted-foreground">
                                <span>{listTime(event)}</span>
                                {#if event.location}<span> · {event.location}</span>{/if}
                              </p>
                              {@render metaBadges(event)}
                            </Item.Content>
                            <Item.Actions>
                              {@render statusBadge(event)}
                            </Item.Actions>
                          </a>
                        {/snippet}
                      </MobileListCard>
                    </div>
                  {/each}
                </Item.Group>
              </section>
            {/each}
          </div>
        {/snippet}
        {#snippet desktop()}
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>{youngCopy.eventName}</Table.Head>
                <Table.Head>{youngCopy.eventTime}</Table.Head>
                <Table.Head>{youngCopy.location}</Table.Head>
                <Table.Head class="text-right" style="text-align: right">{youngCopy.capacity}</Table.Head>
                <Table.Head>{youngCopy.status}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each data as event (event.youngId)}
                <Table.Row>
                  <Table.Cell>
                      <a class="font-medium underline-offset-4 hover:underline" href={youngDetailHref(event.youngId)}>
                        <span>{event.name}</span>
                      </a>
                      {@render metaBadges(event)}
                  </Table.Cell>
                  <Table.Cell>{listTime(event)}</Table.Cell>
                  <Table.Cell><span>{event.location ?? ""}</span></Table.Cell>
                    <Table.Cell class="text-right tabular-nums" style="text-align: right">{event.appliedCount != null && event.appliedCount > 0 ? youngCapacity(event.appliedCount, event.capacity, youngCopy.unknownValue) : ""}</Table.Cell>
                  <Table.Cell>{@render statusBadge(event)}</Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        {/snippet}
      </ResponsiveCollection>
    {:else}
      <CollectionEmpty
        description={youngCopy.description}
        title={youngCopy.noEventsFound}
        variant="browse"
      />
    {/if}
  </section>
</CollectionPage>
