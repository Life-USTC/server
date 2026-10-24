<script lang="ts">
import ActiveFilters from "#lib/components/ActiveFilters.svelte";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import ListPagination from "#lib/components/ListPagination.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import ResultsEmpty from "#lib/components/ResultsEmpty.svelte";
import ResultsSummary from "#lib/components/ResultsSummary.svelte";
import SearchField from "#lib/components/SearchField.svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import { toolbarControlClass } from "#lib/components/toolbar-control.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import { catalogShowingSummary } from "@/features/catalog/lib/catalog-results-summary";
import type {
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { page as appPage } from "$app/state";
import { removeYoungFilter } from "../lib/young-navigation";
import YoungSourceNote from "./YoungSourceNote.svelte";

type Props = {
  copy: AppPageCopy;
  data: YoungOrganizerSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  search?: string;
  source: YoungSourceFreshness;
};

let { copy, data, pagination, search, source }: Props = $props();

let searchDraft = $derived(search ?? "");
const youngCopy = $derived(copy.youngEvents);
const commonLabels = $derived(copy.common);

function pageHref(targetPage: number) {
  const params = new URLSearchParams(appPage.url.search);
  params.set("page", String(targetPage));
  return `${appPage.url.pathname}?${params}`;
}

function organizerHref(id: string) {
  return `/catalog/young-events/organizers/${id}`;
}

function eventsHref(id: string) {
  return `/catalog/young-events?active=true&organizerId=${encodeURIComponent(id)}`;
}

const summary = $derived(
  catalogShowingSummary(
    pagination.total === 1
      ? youngCopy.organizersShowingOne
      : youngCopy.organizersShowing,
    data.length,
    pagination.total,
  ),
);
</script>

{#snippet paginationFooter()}
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
{/snippet}

{#snippet controls(prefix: string)}
    <div class="grid min-w-0 gap-3">
          <form
            action="/catalog/young-events/organizers"
            method="get"
            class="flex min-w-0 flex-1 items-center gap-2"
          >
            <SearchField
              id={prefix + "-young-organizer-search"}
              label={commonLabels.search}
              name="search"
              placeholder={youngCopy.organizerSearchPlaceholder}
              bind:value={searchDraft}
            />
            <Button type="submit" class={toolbarControlClass}>
              {commonLabels.search}
            </Button>
          </form>

      <ActiveFilters
        items={search
          ? [
              {
                href: removeYoungFilter(new URL(appPage.url.href), "search"),
                label: search,
                removeLabel: youngCopy.removeFilter.replace("{value}", () => search),
              },
            ]
          : []}
        ariaLabel={youngCopy.activeFilters}
        clearHref="/catalog/young-events/organizers"
        clearLabel={commonLabels.clear}
      />
    </div>
{/snippet}


{#snippet empty()}
      <div class="py-10">
        <ResultsEmpty
          description={youngCopy.organizersDescription}
          title={youngCopy.noOrganizersFound}
        />
      </div>
{/snippet}

<CollectionPage
  description={youngCopy.organizersDescription}
  footer={pagination.totalPages > 1 ? paginationFooter : undefined}
  title={youngCopy.organizersTitle}
>
  <section
    class="flex min-h-[calc(100dvh-16rem)] min-w-0 flex-col gap-3"
  >
    <ResultsSummary
      summary={summary}
      page={pagination.page}
      totalPages={pagination.totalPages}
    />

      <ResponsiveCollection>
        {#snippet mobile()}
          <div class="mb-3" data-slot="collection-header">{@render controls("mobile")}</div>
          {#if data.length > 0}
          <Item.Group class="gap-0" role="list">
            {#each data as organizer, index (organizer.id)}
              <div role="listitem">
                <MobileListCard size="sm">
                  {#snippet child({ props })}
                    <a href={organizerHref(organizer.id)} {...props}>
                      <Item.Content>
                        <Item.Title>{organizer.name}</Item.Title>
                        <Item.Description title={youngCopy.organizerCountsHint}>
                            {youngCopy.activeEvents}: {organizer.activeCount} ·
                            {youngCopy.upcomingEvents}: {organizer.upcomingCount} ·
                            {youngCopy.historyEvents}: {organizer.historyCount}
                        </Item.Description>
                      </Item.Content>
                        <Item.Actions>
                          <span class="text-xs underline underline-offset-4">{youngCopy.organizerEvents}</span>
                        </Item.Actions>
                    </a>
                  {/snippet}
                </MobileListCard>
                {#if index < data.length - 1}
                  <Item.Separator />
                {/if}
              </div>
            {/each}
          </Item.Group>
          {:else}
            {@render empty()}
          {/if}
        {/snippet}
        {#snippet desktop()}
          <Table.Root>
            <Table.Header>
              <TableControlsRow colspan={4}>{@render controls("desktop")}</TableControlsRow>
              <Table.Row>
                <Table.Head>{youngCopy.organizer}</Table.Head>
                <Table.Head
                  class="text-right"
                  style="text-align: right"
                  title={youngCopy.activeEventsTitle}
                >{youngCopy.activeEvents}</Table.Head>
                <Table.Head
                  class="text-right"
                  style="text-align: right"
                  title={youngCopy.upcomingEventsTitle}
                >{youngCopy.upcomingEvents}</Table.Head>
                <Table.Head
                  class="text-right"
                  style="text-align: right"
                  title={youngCopy.historyEventsTitle}
                >{youngCopy.historyEvents}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each data as organizer (organizer.id)}
                <Table.Row class="has-[a:hover]:bg-muted/50">
                  <Table.Cell class="p-0">
                      <a class="block px-4 py-3 font-medium underline-offset-4 hover:underline" href={organizerHref(organizer.id)}>
                        {organizer.name}
                      </a>
                  </Table.Cell>
                    <Table.Cell class="text-right tabular-nums" style="text-align: right">
                      <a class="underline underline-offset-4" href={eventsHref(organizer.id)}>{organizer.activeCount}</a>
                  </Table.Cell>
                    <Table.Cell class="text-right tabular-nums" style="text-align: right">{organizer.upcomingCount}</Table.Cell>
                    <Table.Cell class="text-right tabular-nums" style="text-align: right">{organizer.historyCount}</Table.Cell>
                </Table.Row>
              {/each}
            {#if data.length === 0}<Table.Row><Table.Cell colspan={4}>{@render empty()}</Table.Cell></Table.Row>{/if}
            </Table.Body>
          </Table.Root>
        {/snippet}
      </ResponsiveCollection>


    <div class="mt-auto grid justify-items-end gap-1 pt-8"><YoungSourceNote labels={youngCopy} source={source} /></div>
  </section>
</CollectionPage>
