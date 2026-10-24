<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import ListPagination from "#lib/components/ListPagination.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import ResultsSummary from "#lib/components/ResultsSummary.svelte";
import SearchField from "#lib/components/SearchField.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import { resolveStatusToken } from "#lib/ui/action-status-tokens.js";
import { catalogShowingSummary } from "@/features/catalog/lib/catalog-results-summary";
import type {
  YoungEventSummary,
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { tableFilterValues } from "@/lib/table-filters";
import { page as appPage } from "$app/state";
import {
  groupYoungEventsByStartDate,
  youngCapacity,
  youngEventStatusLabel,
  youngListDayLabel,
  youngListTimeLabel,
} from "../lib/young-event-display";
import { youngDetailHref } from "../lib/young-navigation";
import { youngEventTableFields } from "../lib/young-table-filters";
import YoungEventFilters from "./YoungEventFilters.svelte";
import YoungSourceNote from "./YoungSourceNote.svelte";

type Props = {
  categories: string[];
  copy: AppPageCopy;
  data: YoungEventSummary[];
  tableFilters: Record<string, string>;
  organizers: Pick<YoungOrganizerSummary, "id" | "name">[];
  source: YoungSourceFreshness;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

let {
  categories,
  copy,
  data,
  tableFilters,
  organizers,
  pagination,
  source,
}: Props = $props();

let draft = $derived({ ...tableFilters });
const fields = $derived(
  youngEventTableFields(
    copy,
    categories,
    organizers,
    draft.timeBasis,
    draft.category,
  ),
);
const appliedFields = $derived(
  youngEventTableFields(
    copy,
    categories,
    organizers,
    tableFilters.timeBasis,
    tableFilters.category,
  ),
);
const columns = $derived([
  { label: copy.youngEvents.eventName, names: ["search"] },
  { label: copy.youngEvents.eventTime, names: ["startAt"] },
  { label: copy.youngEvents.location, names: ["location"] },
  { label: copy.youngEvents.capacity, names: ["capacity", "appliedCount"] },
  { label: copy.youngEvents.status, names: ["status"] },
]);
const extras = $derived(
  fields.filter(
    (field) => !columns.some((column) => column.names.includes(field.name)),
  ),
);
function patchDraft(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}

function summaryValue(field: (typeof fields)[number], value: string) {
  return field.options
    ? value
        .split(",")
        .map(
          (item) =>
            field.options?.find((option) => option.value === item)?.label ??
            item,
        )
        .join(", ")
    : value;
}
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

{#snippet empty()}
  <CollectionEmpty description={youngCopy.description} title={youngCopy.noEventsFound} variant="browse" />
{/snippet}

{#snippet columnFilter(label: string, names: string[], prefix: string)}
  <YoungEventFilters {copy} fields={fields.filter((field) => names.includes(field.name))} values={draft} applied={tableFilters} onchange={patchDraft} {label} prefix={`${prefix}-${names[0]}`} formId="young-event-filters" />
{/snippet}

<CollectionPage footer={paginationFooter} title={youngCopy.title}>
  {#snippet belowTitle()}
    {@render description()}
  {/snippet}
  <section class="grid min-w-0 gap-3">
    <ResultsSummary
      summary={summary}
      page={pagination.page}
      totalPages={pagination.totalPages}
    />

      <div class="grid min-w-0 gap-3" data-slot="table-filter-toolbar">
      <form id="young-event-filters" action="/catalog/young-events" method="get" class="flex min-w-0 flex-wrap items-center gap-3" data-slot="table-filter-apply">
        {#each Object.entries(draft).filter(([, value]) => value) as [name, value]}
          {#if name === "category"}
            {#each tableFilterValues(value) as category}
              <input type="hidden" name="category" value={decodeURIComponent(category)} />
            {/each}
          {:else}
            <input type="hidden" {name} {value} />
          {/if}
        {/each}
        <div class="flex w-full min-w-0 sm:w-auto sm:flex-1">
          <SearchField id="young-event-search" label={copy.common.search} placeholder={youngCopy.searchPlaceholder} bind:value={() => draft.search ?? "", (value) => patchDraft({ search: value })} />
        </div>
        <Button type="submit">{copy.common.applyFilters}</Button>
        <Button type="button" variant="ghost" onclick={() => { draft = {}; }}>{copy.common.clear}</Button>
      </form>
      <div class="flex flex-wrap items-center gap-3">
        {#each extras as field}
          <YoungEventFilters {copy} fields={[field]} values={draft} applied={tableFilters} onchange={patchDraft} label={field.label} prefix={`extra-${field.name}`} formId="young-event-filters" />
        {/each}
      </div>
      </div>
      {#if appliedFields.some((field) => tableFilters[field.name])}
        <div class="flex flex-wrap gap-2" role="group" aria-label={youngCopy.activeFilters}>
          {#each appliedFields.filter((field) => tableFilters[field.name]) as field}
            <Badge variant="outline" class="h-auto max-w-full whitespace-normal [overflow-wrap:anywhere]">{field.label}: {summaryValue(field, tableFilters[field.name])}</Badge>
          {/each}
        </div>
      {/if}
      <ResponsiveCollection>
        {#snippet mobile()}
          <div class="mb-3 flex flex-wrap gap-3" data-slot="collection-header">
            {#each columns as column}
              {@render columnFilter(column.label, column.names, "mobile")}
            {/each}
          </div>
          {#if data.length > 0}
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
          {:else}
            {@render empty()}
          {/if}
        {/snippet}
        {#snippet desktop()}
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>{@render columnFilter(youngCopy.eventName, ["search"], "desktop")}</Table.Head>
                <Table.Head>{@render columnFilter(youngCopy.eventTime, ["startAt"], "desktop")}</Table.Head>
                <Table.Head>{@render columnFilter(youngCopy.location, ["location"], "desktop")}</Table.Head>
                <Table.Head>{@render columnFilter(youngCopy.capacity, ["capacity", "appliedCount"], "desktop")}</Table.Head>
                <Table.Head>{@render columnFilter(youngCopy.status, ["status"], "desktop")}</Table.Head>
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
                    <Table.Cell class="text-left tabular-nums">{event.appliedCount != null && event.appliedCount > 0 ? youngCapacity(event.appliedCount, event.capacity, youngCopy.unknownValue) : ""}</Table.Cell>
                  <Table.Cell>{@render statusBadge(event)}</Table.Cell>
                </Table.Row>
              {/each}
            {#if data.length === 0}<Table.Row><Table.Cell colspan={5}>{@render empty()}</Table.Cell></Table.Row>{/if}
            </Table.Body>
          </Table.Root>
        {/snippet}
      </ResponsiveCollection>

  </section>
</CollectionPage>
