<script lang="ts">
import CatalogPagination from "@/features/catalog/components/CatalogPagination.svelte";
import CatalogResultsEmpty from "@/features/catalog/components/CatalogResultsEmpty.svelte";
import CatalogResultsSummary from "@/features/catalog/components/CatalogResultsSummary.svelte";
import CatalogTableLink from "@/features/catalog/components/CatalogTableLink.svelte";
import { catalogListPageHref } from "@/features/catalog/lib/catalog-list-query";
import {
  catalogShowingSummary,
  optionalCatalogFilterSummary,
} from "@/features/catalog/lib/catalog-results-summary";
import type { WorkspacePageCopy } from "@/features/workspace/server/dashboard-page-load-types";
import type { YoungEventSummary } from "@/features/young/server/young-event-service";
import type { YoungEventsPageFilters } from "@/features/young/server/young-page-load";
import { page as appPage } from "$app/stores";
import PageLayout from "$lib/components/PageLayout.svelte";
import Panel from "$lib/components/Panel.svelte";
import ResponsiveCollection from "$lib/components/ResponsiveCollection.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import * as Table from "$lib/components/ui/table/index.js";

type Props = {
  categories: string[];
  copy: WorkspacePageCopy;
  data: YoungEventSummary[];
  filters: YoungEventsPageFilters;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

let { categories, copy, data, filters, pagination }: Props = $props();

const youngCopy = $derived(copy.youngEvents);
const commonLabels = $derived(copy.common);

function formatDateTime(value: string | null) {
  return value ? value.slice(0, 16).replace("T", " ") : "-";
}

function pageHref(targetPage: number) {
  return catalogListPageHref($appPage.url, targetPage);
}

const summaryBase = $derived(
  catalogShowingSummary(youngCopy.showing, data.length, pagination.total),
);
const searchSummary = $derived(
  optionalCatalogFilterSummary(filters.search, youngCopy.searchFor, "{query}"),
);
</script>

{#snippet paginationFooter()}
  <CatalogPagination
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

<PageLayout description={youngCopy.description} title={youngCopy.title}>
  <Panel footer={pagination.totalPages > 1 ? paginationFooter : undefined}>
    {#snippet header()}
      <form
        action="/catalog/young-events"
        class="flex flex-wrap items-end gap-3"
        method="get"
      >
        <div class="grid min-w-48 flex-1 gap-1.5">
          <label class="text-sm font-medium" for="young-event-search">
            {commonLabels.search}
          </label>
          <Input
            id="young-event-search"
            name="search"
            placeholder={youngCopy.searchPlaceholder}
            type="search"
            value={filters.search ?? ""}
          />
        </div>
        <div class="grid gap-1.5">
          <label class="text-sm font-medium" for="young-event-active">
            {youngCopy.signupStatus}
          </label>
          <NativeSelect.Root
            id="young-event-active"
            name="active"
            value={filters.active == null ? "" : String(filters.active)}
          >
            <NativeSelect.Option value="">{youngCopy.statusAll}</NativeSelect.Option>
            <NativeSelect.Option value="true">{youngCopy.statusActive}</NativeSelect.Option>
            <NativeSelect.Option value="false">{youngCopy.statusEnded}</NativeSelect.Option>
          </NativeSelect.Root>
        </div>
        <div class="grid gap-1.5">
          <label class="text-sm font-medium" for="young-event-category">
            {youngCopy.category}
          </label>
          <NativeSelect.Root
            id="young-event-category"
            name="category"
            value={filters.category ?? ""}
          >
            <NativeSelect.Option value="">{youngCopy.allCategories}</NativeSelect.Option>
            {#each categories as category (category)}
              <NativeSelect.Option value={category}>{category}</NativeSelect.Option>
            {/each}
          </NativeSelect.Root>
        </div>
        <Button type="submit">{commonLabels.search}</Button>
        <Button href="/catalog/young-events" variant="outline">
          {commonLabels.clear}
        </Button>
      </form>
    {/snippet}

    <section class="grid min-w-0 gap-3">
      <CatalogResultsSummary
        base={summaryBase}
        page={pagination.page}
        searchText={searchSummary}
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
                      <a href={`/catalog/young-events/${event.youngId}`} {...props}>
                        <Item.Content>
                          <Item.Title>{event.name}</Item.Title>
                        </Item.Content>
                        <Item.Actions>
                          {formatDateTime(event.startAt)}
                        </Item.Actions>
                        <Item.Footer class="flex-wrap justify-start">
                          <span>{event.category ?? "-"}</span>
                          <span>{event.registrationStatus ?? "-"}</span>
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
                  <Table.Head>{youngCopy.eventName}</Table.Head>
                  <Table.Head>{youngCopy.category}</Table.Head>
                  <Table.Head>{youngCopy.eventTime}</Table.Head>
                  <Table.Head>{youngCopy.signupWindow}</Table.Head>
                  <Table.Head>{youngCopy.capacity}</Table.Head>
                  <Table.Head>{youngCopy.registrationStatus}</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each data as event (event.youngId)}
                  <Table.Row class="has-[a:hover]:bg-muted/50">
                    <Table.Cell class="p-0">
                      <CatalogTableLink href={`/catalog/young-events/${event.youngId}`}>
                        <TruncatedText text={event.name} />
                      </CatalogTableLink>
                    </Table.Cell>
                    <Table.Cell>{event.category ?? "-"}</Table.Cell>
                    <Table.Cell class="whitespace-nowrap">
                      {formatDateTime(event.startAt)}
                    </Table.Cell>
                    <Table.Cell class="whitespace-nowrap">
                      {formatDateTime(event.applyStartAt)} ~ {formatDateTime(event.applyEndAt)}
                    </Table.Cell>
                    <Table.Cell class="tabular-nums">
                      {event.appliedCount ?? 0}{event.capacity != null ? ` / ${event.capacity}` : ""}
                    </Table.Cell>
                    <Table.Cell>{event.registrationStatus ?? "-"}</Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          {/snippet}
        </ResponsiveCollection>
      {:else}
        <div class="py-10">
          <CatalogResultsEmpty
            centered
            description={youngCopy.description}
            title={youngCopy.noEventsFound}
          />
        </div>
      {/if}
    </section>
  </Panel>
</PageLayout>
