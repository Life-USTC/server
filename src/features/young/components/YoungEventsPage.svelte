<script lang="ts">
import XIcon from "@lucide/svelte/icons/x";
import CatalogPagination from "@/features/catalog/components/CatalogPagination.svelte";
import CatalogResultsEmpty from "@/features/catalog/components/CatalogResultsEmpty.svelte";
import CatalogResultsSummary from "@/features/catalog/components/CatalogResultsSummary.svelte";
import CatalogTableLink from "@/features/catalog/components/CatalogTableLink.svelte";
import { catalogListPageHref } from "@/features/catalog/lib/catalog-list-query";
import {
  catalogShowingSummary,
  optionalCatalogFilterSummary,
} from "@/features/catalog/lib/catalog-results-summary";
import type {
  YoungEventSummary,
  YoungOrganizerSummary,
  YoungSourceFreshness,
} from "@/features/young/server/young-event-service";
import type { YoungEventsPageFilters } from "@/features/young/server/young-page-load";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { page as appPage } from "$app/stores";
import PageLayout from "$lib/components/PageLayout.svelte";
import Panel from "$lib/components/Panel.svelte";
import ResponsiveCollection from "$lib/components/ResponsiveCollection.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { buttonVariants } from "$lib/components/ui/button";
import { Button } from "$lib/components/ui/button/index.js";
import * as Collapsible from "$lib/components/ui/collapsible";
import * as Field from "$lib/components/ui/field";
import { Input } from "$lib/components/ui/input/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import {
  youngCapacity,
  youngDateRange,
  youngDateTime,
} from "../lib/young-event-display";
import { removeYoungFilter, youngDetailHref } from "../lib/young-navigation";
import YoungBrowseNav from "./YoungBrowseNav.svelte";

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
let advancedOpen = $state(false);
const activeFilters = $derived(
  [
    { key: "search", value: filters.search },
    {
      key: "active",
      value:
        filters.active == null
          ? null
          : filters.active
            ? youngCopy.statusActive
            : youngCopy.statusEnded,
    },
    {
      key: "organizerId",
      value: filters.organizerId
        ? (organizers.find((item) => item.id === filters.organizerId)?.name ??
          filters.organizerId)
        : null,
    },
    { key: "category", value: filters.category },
    { key: "module", value: filters.module },
    { key: "activityLevel", value: filters.activityLevel },
    {
      key: "dateUnknown",
      value:
        filters.dateUnknown == null
          ? null
          : filters.dateUnknown
            ? filters.timeBasis === "registration"
              ? youngCopy.dateUnknownRegistration
              : youngCopy.dateUnknownActivity
            : filters.timeBasis === "registration"
              ? youngCopy.dateKnownRegistration
              : youngCopy.dateKnownActivity,
    },
  ].filter((item) => item.value),
);

// Fixed upstream enumerations. Values outside these lists still render as
// badges; they are simply not offered as filters.
const MODULE_OPTIONS = ["德", "智", "体", "美", "劳"];
const ACTIVITY_LEVEL_OPTIONS = ["班级", "院级", "校级", "省级", "国家级"];

function formatDateTime(value: string | null) {
  return youngDateTime(value) ?? youngCopy.unknownTime;
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
  <YoungBrowseNav current="events" copy={youngCopy} />
  <div class="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm" data-testid="young-source-freshness">
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
      <form
        action="/catalog/young-events"
        class="grid gap-3"
        method="get"
      >
        {#if filters.dateUnknown != null}<input type="hidden" name="dateUnknown" value={String(filters.dateUnknown)} />{/if}
        {#if filters.timeBasis}<input type="hidden" name="timeBasis" value={filters.timeBasis} />{/if}

        <Field.FieldGroup class="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Field.Field>
          <Field.FieldLabel for="young-event-search">
            {commonLabels.search}
          </Field.FieldLabel>
          <Input
            id="young-event-search"
            name="search"
            placeholder={youngCopy.searchPlaceholder}
            type="search"
            value={filters.search ?? ""}
          />
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel for="young-event-active">
            {youngCopy.signupStatus}
          </Field.FieldLabel>
          <NativeSelect.Root
            id="young-event-active"
            name="active"
            value={filters.active == null ? "" : String(filters.active)}
          >
            <NativeSelect.Option value="">{youngCopy.statusAll}</NativeSelect.Option>
            <NativeSelect.Option value="true">{youngCopy.statusActive}</NativeSelect.Option>
            <NativeSelect.Option value="false">{youngCopy.statusEnded}</NativeSelect.Option>
          </NativeSelect.Root>
        </Field.Field>
        <div class="flex gap-2">
          <Button type="submit">{commonLabels.search}</Button>
          {#if activeFilters.length}<Button href="/catalog/young-events" variant="ghost">{commonLabels.clear}</Button>{/if}
        </div>
        </Field.FieldGroup>
        <Collapsible.Root bind:open={advancedOpen}>
          <Collapsible.Trigger class={buttonVariants({ variant: "outline", size: "sm" })}>{youngCopy.moreFilters}</Collapsible.Trigger>
          <Collapsible.Content forceMount hidden={!advancedOpen}>
            <Field.FieldGroup class="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field.Field>
          <Field.FieldLabel for="young-event-organizer">
            {youngCopy.organizerFilter}
          </Field.FieldLabel>
          <NativeSelect.Root
            id="young-event-organizer"
            name="organizerId"
            value={filters.organizerId ?? ""}
          >
            <NativeSelect.Option value="">{youngCopy.allOrganizers}</NativeSelect.Option>
            {#each organizers as organizer (organizer.id)}
              <NativeSelect.Option value={organizer.id}>{organizer.name}</NativeSelect.Option>
            {/each}
          </NativeSelect.Root>
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel for="young-event-category">
            {youngCopy.category}
          </Field.FieldLabel>
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
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel for="young-event-module">
            {youngCopy.module}
          </Field.FieldLabel>
          <NativeSelect.Root
            id="young-event-module"
            name="module"
            value={filters.module ?? ""}
          >
            <NativeSelect.Option value="">{youngCopy.allModules}</NativeSelect.Option>
            {#each MODULE_OPTIONS as moduleOption (moduleOption)}
              <NativeSelect.Option value={moduleOption}>{moduleOption}</NativeSelect.Option>
            {/each}
          </NativeSelect.Root>
        </Field.Field>
        <Field.Field>
          <Field.FieldLabel for="young-event-activity-level">
            {youngCopy.activityLevel}
          </Field.FieldLabel>
          <NativeSelect.Root
            id="young-event-activity-level"
            name="activityLevel"
            value={filters.activityLevel ?? ""}
          >
            <NativeSelect.Option value="">{youngCopy.allActivityLevels}</NativeSelect.Option>
            {#each ACTIVITY_LEVEL_OPTIONS as levelOption (levelOption)}
              <NativeSelect.Option value={levelOption}>{levelOption}</NativeSelect.Option>
            {/each}
          </NativeSelect.Root>
        </Field.Field>
            </Field.FieldGroup>
          </Collapsible.Content>
        </Collapsible.Root>
      </form>
    {/snippet}

    <section class="grid min-w-0 gap-3">
      {#if activeFilters.length}
        <nav class="flex flex-wrap gap-2" aria-label={youngCopy.activeFilters}>
          {#each activeFilters as filter (filter.key)}
            <Button href={removeYoungFilter($appPage.url, filter.key)} variant="secondary" size="sm" aria-label={youngCopy.removeFilter.replace("{value}", String(filter.value))}>{filter.value}<XIcon data-icon="inline-end" /></Button>
          {/each}
        </nav>
      {/if}
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
                      <CatalogTableLink href={youngDetailHref(event.youngId, $appPage.url)}>
                        <div class="grid gap-1">
                          <span class="whitespace-normal break-words font-medium">{event.name}</span>
                          <span class="text-xs text-muted-foreground">{[event.category, event.module, event.activityLevel].filter(Boolean).join(" · ")}</span>
                          {#if event.location || event.isOnline === true}
                            <span class="text-xs text-muted-foreground">{[event.location, event.isOnline === true ? youngCopy.online : null].filter(Boolean).join(" · ")}</span>
                          {/if}
                        </div>
                      </CatalogTableLink>
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
