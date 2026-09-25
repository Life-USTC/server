<script lang="ts">
import CatalogPagination from "@/features/catalog/components/CatalogPagination.svelte";
import CatalogResultsEmpty from "@/features/catalog/components/CatalogResultsEmpty.svelte";
import CatalogResultsSummary from "@/features/catalog/components/CatalogResultsSummary.svelte";
import { catalogListPageHref } from "@/features/catalog/lib/catalog-list-query";
import {
  catalogShowingSummary,
  optionalCatalogFilterSummary,
} from "@/features/catalog/lib/catalog-results-summary";
import type {
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { page as appPage } from "$app/stores";
import PageLayout from "$lib/components/PageLayout.svelte";
import Panel from "$lib/components/Panel.svelte";
import ResponsiveCollection from "$lib/components/ResponsiveCollection.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field";
import { Input } from "$lib/components/ui/input/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import YoungBrowseNav from "./YoungBrowseNav.svelte";

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
  return catalogListPageHref($appPage.url, targetPage);
}

function organizerHref(id: string) {
  return `/catalog/young-events/organizers/${id}`;
}

function eventsHref(id: string) {
  return `/catalog/young-events?active=true&organizerId=${encodeURIComponent(id)}`;
}

function formatSourceDate(value: string | null) {
  return value ? value.slice(0, 16).replace("T", " ") : "-";
}

const summaryBase = $derived(
  catalogShowingSummary(
    youngCopy.organizersShowing,
    data.length,
    pagination.total,
  ),
);
const searchSummary = $derived(
  optionalCatalogFilterSummary(search, youngCopy.searchFor, "{query}"),
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

<PageLayout description={youngCopy.organizersDescription} title={youngCopy.organizersTitle}>
  <YoungBrowseNav current="organizers" copy={youngCopy} />
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

  </div>

  <Panel footer={pagination.totalPages > 1 ? paginationFooter : undefined}>
    {#snippet header()}
      <form action="/catalog/young-events/organizers" class="flex flex-wrap items-end gap-3" method="get">
        <Field.FieldGroup class="flex-row flex-wrap items-end gap-3">
        <Field.Field class="min-w-48 flex-1">
          <Field.FieldLabel for="young-organizer-search">
            {commonLabels.search}
          </Field.FieldLabel>
          <Input
            id="young-organizer-search"
            name="search"
            placeholder={youngCopy.organizerSearchPlaceholder}
            type="search"
            value={search ?? ""}
          />
        </Field.Field>
        <Button type="submit">{commonLabels.search}</Button>
        <Button href="/catalog/young-events/organizers" variant="outline">{commonLabels.clear}</Button>

        </Field.FieldGroup>
      </form>
    {/snippet}

    <section class="grid min-w-0 gap-3">
      <p class="text-sm text-muted-foreground">{youngCopy.organizerCountsHint}</p>
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
          <CatalogResultsEmpty
            centered
            description={youngCopy.organizersDescription}
            title={youngCopy.noOrganizersFound}
          />
        </div>
      {/if}
    </section>
  </Panel>
</PageLayout>
