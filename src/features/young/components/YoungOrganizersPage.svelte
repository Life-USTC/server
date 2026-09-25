<script lang="ts">
import type {
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { page as appPage } from "$app/stores";
import ActiveFilters from "$lib/components/ActiveFilters.svelte";
import FilterToolbar from "$lib/components/FilterToolbar.svelte";
import ListPagination from "$lib/components/ListPagination.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import PageLayout from "$lib/components/PageLayout.svelte";
import Panel from "$lib/components/Panel.svelte";
import ResponsiveCollection from "$lib/components/ResponsiveCollection.svelte";
import ResultsEmpty from "$lib/components/ResultsEmpty.svelte";
import ResultsSummary from "$lib/components/ResultsSummary.svelte";
import SearchField from "$lib/components/SearchField.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field";
import * as Item from "$lib/components/ui/item/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import { removeYoungFilter } from "../lib/young-navigation";
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

function formatSourceDate(value: string | null) {
  return value ? value.slice(0, 16).replace("T", " ") : "-";
}

const summary = $derived(
  youngCopy.organizersShowing
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
  {#snippet header()}<PageHeader title={youngCopy.organizersTitle} description={youngCopy.organizersDescription} />{/snippet}
  <YoungBrowseNav current="organizers" copy={youngCopy} />
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

  <Panel footer={pagination.totalPages > 1 ? paginationFooter : undefined}>
    {#snippet header()}
      <FilterToolbar>
        {#snippet primary()}
          <form action="/catalog/young-events/organizers" method="get">
            <Field.FieldGroup class="flex-row flex-wrap items-end gap-3">
            <div class="min-w-48 flex-1"><SearchField id="young-organizer-search" label={commonLabels.search} name="search" placeholder={youngCopy.organizerSearchPlaceholder} value={search ?? ""} /></div>
            <Button type="submit" class="h-11">{commonLabels.search}</Button>
            </Field.FieldGroup>
          </form>
        {/snippet}
      </FilterToolbar>
      <ActiveFilters items={search ? [{ href: removeYoungFilter($appPage.url, "search"), label: search, removeLabel: youngCopy.removeFilter.replace("{value}", search) }] : []} ariaLabel={youngCopy.activeFilters} clearHref="/catalog/young-events/organizers" clearLabel={commonLabels.clear} />
    {/snippet}

    <section class="grid min-w-0 gap-3">
      <p class="text-sm text-muted-foreground">{youngCopy.organizerCountsHint}</p>
      <ResultsSummary
        {summary}
        page={pagination.page}
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
          <ResultsEmpty
            description={youngCopy.organizersDescription}
            title={youngCopy.noOrganizersFound}
          />
        </div>
      {/if}
    </section>
  </Panel>
</PageLayout>
