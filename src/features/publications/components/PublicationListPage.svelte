<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import {
  publicationDetailHref,
  publicationListHref,
} from "@/features/publications/lib/publication-page-navigation";
import type { PublicationSourceOrganizationLevel } from "@/features/publications/lib/publication-source-levels";
import { publicationSummary } from "@/features/publications/lib/publication-summary";
import { goto } from "$app/navigation";
import ActiveFilters from "$lib/components/ActiveFilters.svelte";
import FilterToolbar from "$lib/components/FilterToolbar.svelte";
import ListPagination from "$lib/components/ListPagination.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import PageLayout from "$lib/components/PageLayout.svelte";
import Panel from "$lib/components/Panel.svelte";
import ResultsEmpty from "$lib/components/ResultsEmpty.svelte";
import ResultsSummary from "$lib/components/ResultsSummary.svelte";
import SearchField from "$lib/components/SearchField.svelte";
import { Badge } from "$lib/components/ui/badge";
import { Button } from "$lib/components/ui/button";
import { Checkbox } from "$lib/components/ui/checkbox";
import * as Field from "$lib/components/ui/field";
import * as ToggleGroup from "$lib/components/ui/toggle-group";
import { formatShanghaiDate } from "$lib/time/shanghai-format";
import PublicationSourceFilter from "./PublicationSourceFilter.svelte";
import PublicationTypeBadge from "./PublicationTypeBadge.svelte";
import type {
  PublicationListPageData,
  PublicationPageCopy,
} from "./publication-component-types";

let {
  copy,
  data,
}: { copy: PublicationPageCopy; data: PublicationListPageData } = $props();
let filtersOpen = $state(false);
let query = $derived(data.filters.query ?? "");
let sourceDraft = $state<string[]>([]);
let levelsDraft = $state<PublicationSourceOrganizationLevel[]>([]);
let foldDraft = $state(false);
const advancedCount = $derived(
  (data.filters.source?.length ?? 0) +
    (data.filters.organizationLevel?.length ?? 0) +
    Number(data.filters.fold ?? false),
);

function setFiltersOpen(open: boolean) {
  if (open) {
    sourceDraft = [...(data.filters.source ?? [])];
    levelsDraft = [...(data.filters.organizationLevel ?? [])];
    foldDraft = data.filters.fold ?? false;
  }
  filtersOpen = open;
}
const availableLevels = $derived([
  ...new Set(data.sourceOptions.map((option) => option.organizationLevel)),
]);
const returnHref = $derived(
  publicationListHref(data.filters, data.publications.pagination.page),
);
const activeFilters = $derived([
  ...(data.filters.type
    ? [
        {
          label: data.filters.type === "news" ? copy.news : copy.notice,
          href: publicationListHref({ ...data.filters, type: undefined }),
        },
      ]
    : []),
  ...(data.filters.query
    ? [
        {
          label: data.filters.query,
          href: publicationListHref({ ...data.filters, query: undefined }),
        },
      ]
    : []),
  ...(data.filters.source ?? []).map((id) => ({
    label: data.sourceOptions.find((source) => source.id === id)?.name ?? id,
    href: publicationListHref({
      ...data.filters,
      source: data.filters.source?.filter((source) => source !== id),
    }),
  })),
  ...(data.filters.organizationLevel ?? []).map((level) => ({
    label: copy.organizationLevelLabels[level],
    href: publicationListHref({
      ...data.filters,
      organizationLevel: data.filters.organizationLevel?.filter(
        (item) => item !== level,
      ),
    }),
  })),
  ...(data.filters.fold
    ? [
        {
          label: copy.foldToggle,
          href: publicationListHref({ ...data.filters, fold: undefined }),
        },
      ]
    : []),
]);
const resultsCount = $derived(
  copy.resultsCount.replace(
    "{count}",
    String(data.publications.pagination.total),
  ),
);

function changeType(value: string) {
  if (!value) return;
  void goto(
    publicationListHref({
      ...data.filters,
      type: value === "all" ? undefined : (value as "news" | "notice"),
    }),
    { keepFocus: true },
  );
}
</script>

<svelte:head><title>{copy.pageTitle} - Life@USTC</title></svelte:head>

<PageLayout>
  {#snippet header()}
    <PageHeader title={copy.pageTitle} description={copy.pageDescription}>
      {#snippet actions()}<Button href="/news/sources" variant="outline">{copy.sourcesTitle}</Button>{/snippet}
    </PageHeader>
  {/snippet}

  {#snippet pagination()}
    <ListPagination page={data.publications.pagination.page} totalPages={data.publications.pagination.totalPages} pageHref={(page) => publicationListHref(data.filters, page)} previousLabel={copy.previousPage} previousPageLabel={copy.previousPage} nextLabel={copy.nextPage} nextPageLabel={copy.nextPage} ariaLabel={copy.pagination} />
  {/snippet}
  <Panel footer={data.publications.pagination.totalPages > 1 ? pagination : undefined}>
    {#snippet header()}
      <div class="grid min-w-0 gap-3">
        <ToggleGroup.Root type="single" variant="outline" bind:value={() => data.filters.type ?? "all", changeType} aria-label={copy.publicationType}>
          <ToggleGroup.Item value="all">{copy.all}</ToggleGroup.Item>
          <ToggleGroup.Item value="news">{copy.news}</ToggleGroup.Item>
          <ToggleGroup.Item value="notice">{copy.notice}</ToggleGroup.Item>
        </ToggleGroup.Root>
        <FilterToolbar filterTitle={copy.advancedFilters} activeCount={advancedCount} bind:open={() => filtersOpen, setFiltersOpen}>
          {#snippet primary()}
            <form method="get" action="/news" class="min-w-0">
              {#if data.filters.type}<input type="hidden" name="type" value={data.filters.type} />{/if}
              {#each data.filters.source ?? [] as source (source)}<input type="hidden" name="source" value={source} />{/each}
              {#each data.filters.organizationLevel ?? [] as level (level)}<input type="hidden" name="organizationLevel" value={level} />{/each}
              {#if data.filters.fold}<input type="hidden" name="fold" value="1" />{/if}
              <Field.Field orientation="horizontal" class="min-w-0 items-end gap-2">
                <SearchField id="publication-query" name="query" label={copy.search} bind:value={query} placeholder={copy.searchPlaceholder} maxlength={200} />
                <Button type="submit" class="h-11"><SearchIcon data-icon="inline-start" aria-hidden="true" />{copy.search}</Button>
              </Field.Field>
            </form>
          {/snippet}
          {#snippet advanced()}
            <form method="get" action="/news" class="min-w-0" onsubmit={() => { filtersOpen = false; }}>
              {#if data.filters.type}<input type="hidden" name="type" value={data.filters.type} />{/if}
              <input type="hidden" name="query" value={query} />
              <Field.Group class="min-w-0 gap-5">
                <PublicationSourceFilter options={data.sourceOptions} bind:selected={sourceDraft} {copy} />
                {#if availableLevels.length > 0}
                  <Field.Set class="min-w-0 gap-3">
                    <Field.Legend>{copy.organizationLevelFilter}</Field.Legend>
                    <Field.Group class="gap-3">
                      {#each availableLevels as level (level)}
                        <Field.Field orientation="horizontal" class="gap-2">
                          <Checkbox id={`publication-level-${level}`} name="organizationLevel" value={level} checked={levelsDraft.includes(level)} onCheckedChange={(checked) => { levelsDraft = checked ? [...levelsDraft, level] : levelsDraft.filter((item) => item !== level); }} />
                          <Field.Label for={`publication-level-${level}`}>{copy.organizationLevelLabels[level]}</Field.Label>
                        </Field.Field>
                      {/each}
                    </Field.Group>
                  </Field.Set>
                {/if}
                <Field.Field orientation="horizontal" class="gap-2">
                  <Checkbox id="publication-fold" name="fold" value="1" bind:checked={foldDraft} />
                  <Field.Label for="publication-fold">{copy.foldToggle}</Field.Label>
                </Field.Field>
                <Button type="submit" class="self-start">{copy.applyFilters}</Button>
              </Field.Group>
            </form>
          {/snippet}
        </FilterToolbar>
        <ActiveFilters items={activeFilters.map((filter) => ({ ...filter, removeLabel: copy.removeFilter.replace("{filter}", filter.label) }))} ariaLabel={copy.activeFilters} clearHref="/news" clearLabel={copy.clearFilters} />
      </div>
    {/snippet}

    <ResultsSummary summary={resultsCount} page={data.publications.pagination.page} totalPages={data.publications.pagination.totalPages} />
    {#if data.publications.data.length === 0}
      <ResultsEmpty title={copy.emptyTitle} description={copy.emptyDescription} />
    {:else}
      <ul class="grid min-w-0 divide-y" aria-label={copy.pageTitle}>
        {#each data.publications.data as item (item.id)}
          {@const summary = publicationSummary(item.revision.title, item.revision.summary)}
          <li class="grid min-w-0 gap-2 py-4">
            <h2 class="min-w-0 text-base font-semibold leading-relaxed [overflow-wrap:anywhere]">
              <a class="hover:underline" href={publicationDetailHref(item.id, returnHref)}>{item.revision.title}</a>
            </h2>
            <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <PublicationTypeBadge type={item.publicationType} {copy} />
              <a class="min-w-0 hover:underline [overflow-wrap:anywhere]" href={publicationListHref({ source: [item.source.id] })}>{item.source.name}</a>
              {#if item.revision.publishedAt}<span>{formatShanghaiDate(item.revision.publishedAt)}</span>{/if}
              {#if item.revision.updatedAtSource && (!item.revision.publishedAt || formatShanghaiDate(item.revision.updatedAtSource) !== formatShanghaiDate(item.revision.publishedAt))}
                <span>{copy.updatedAt}: {formatShanghaiDate(item.revision.updatedAtSource)}</span>
              {/if}
              {#if item.foldGroup}<Badge variant="secondary">{copy.foldSiblingCount.replace("{count}", String(item.foldGroup.siblingCount))}</Badge>{/if}
            </div>
            {#if summary}<p class="line-clamp-2 min-w-0 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{summary}</p>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Panel>
</PageLayout>
