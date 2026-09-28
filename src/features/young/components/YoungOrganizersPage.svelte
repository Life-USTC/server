<script lang="ts">
import type {
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { page as appPage } from "$app/stores";
import ActiveFilters from "$lib/components/ActiveFilters.svelte";
import CollectionPage from "$lib/components/CollectionPage.svelte";
import FilterToolbar from "$lib/components/FilterToolbar.svelte";
import ListPagination from "$lib/components/ListPagination.svelte";
import ResponsiveCollection from "$lib/components/ResponsiveCollection.svelte";
import ResultsEmpty from "$lib/components/ResultsEmpty.svelte";
import SearchField from "$lib/components/SearchField.svelte";
import { toolbarControlClass } from "$lib/components/toolbar-control";
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as Table from "$lib/components/ui/table/index.js";
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

const youngCopy = $derived(copy.youngEvents);
const commonLabels = $derived(copy.common);

function pageHref(targetPage: number) {
  const params = new URLSearchParams($appPage.url.searchParams);
  params.set("page", String(targetPage));
  return `${$appPage.url.pathname}?${params}`;
}

function organizerHref(id: string) {
  return `/catalog/young-events/organizers/${id}`;
}

function eventsHref(id: string) {
  return `/catalog/young-events?active=true&organizerId=${encodeURIComponent(id)}`;
}
</script>

{#snippet paginationFooter()}
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
{/snippet}

<CollectionPage
  description={youngCopy.organizersDescription}
  footer={pagination.totalPages > 1 ? paginationFooter : undefined}
  title={youngCopy.organizersTitle}
>
  {#snippet toolbar()}
      <FilterToolbar>
        {#snippet primary()}
          <form action="/catalog/young-events/organizers" method="get" class="flex min-w-0 flex-1 items-center gap-2">
            <SearchField id="young-organizer-search" label={commonLabels.search} name="search" placeholder={youngCopy.organizerSearchPlaceholder} value={search ?? ""} />
            <Button type="submit" class={toolbarControlClass}>{commonLabels.search}</Button>
          </form>
        {/snippet}
      </FilterToolbar>
      <ActiveFilters items={search ? [{ href: removeYoungFilter($appPage.url, "search"), label: search, removeLabel: youngCopy.removeFilter.replace("{value}", search) }] : []} ariaLabel={youngCopy.activeFilters} clearHref="/catalog/young-events/organizers" clearLabel={commonLabels.clear} />
    {/snippet}

    <section class="flex min-h-[calc(100dvh-16rem)] min-w-0 flex-col gap-3">
      {#if data.length > 0}
        <ResponsiveCollection>
          {#snippet mobile()}
            <Item.Group class="gap-0" role="list">
              {#each data as organizer, index (organizer.id)}
                <div role="listitem">
                  <Item.Root size="sm">
                    {#snippet child({ props })}
                      <a href={organizerHref(organizer.id)} {...props}>
                        <Item.Content>
                          <Item.Title>{organizer.name}</Item.Title>
                          <Item.Description>
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
                  <Table.Head>{youngCopy.organizer}</Table.Head>
                  <Table.Head>{youngCopy.activeEvents}</Table.Head>
                  <Table.Head>{youngCopy.upcomingEvents}</Table.Head>
                  <Table.Head>{youngCopy.historyEvents}</Table.Head>
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
                    <Table.Cell>
                      <a class="underline underline-offset-4" href={eventsHref(organizer.id)}>{organizer.activeCount}</a>
                    </Table.Cell>
                    <Table.Cell>{organizer.upcomingCount}</Table.Cell>
                    <Table.Cell>{organizer.historyCount}</Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          {/snippet}
        </ResponsiveCollection>
      {:else}
        <div class="py-10">
          <ResultsEmpty
            description={youngCopy.organizersDescription}
            title={youngCopy.noOrganizersFound}
          />
        </div>
      {/if}
      <div class="mt-auto grid justify-items-end gap-1 pt-8">
        <YoungSourceNote labels={youngCopy} {source} />
      </div>
    </section>
</CollectionPage>
