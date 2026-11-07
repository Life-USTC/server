<script lang="ts">
import { onMount } from "svelte";
import ActiveFilters, {
  type ActiveFilter,
} from "#lib/components/ActiveFilters.svelte";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import FilterToolbar from "#lib/components/FilterToolbar.svelte";
import ResultsEmpty from "#lib/components/ResultsEmpty.svelte";
import SearchField from "#lib/components/SearchField.svelte";
import { toolbarControlClass } from "#lib/components/toolbar-control.js";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import * as ToggleGroup from "#lib/components/ui/toggle-group/index.js";
import { formatShanghaiDate } from "#lib/time/shanghai-format.js";
import {
  publicationFilterIds,
  publicationFilterLevels,
  publicationFilterValues,
} from "@/features/publications/lib/publication-filter-view";
import {
  publicationDetailHref,
  publicationListHref,
} from "@/features/publications/lib/publication-page-navigation";
import {
  publicationListSummary,
  publicationListSummaryIsUrlHeavy,
} from "@/features/publications/lib/publication-summary";
import type { EndlessScrollState } from "@/lib/navigation/endless-list.svelte";
import { createFilterDraft } from "@/lib/navigation/filter-draft.svelte";
import { goto } from "$app/navigation";
import PublicationTypeBadge from "./PublicationTypeBadge.svelte";
import type {
  PublicationListPageData,
  PublicationPageCopy,
} from "./publication-component-types";

let {
  copy,
  data,
  endless,
}: {
  copy: PublicationPageCopy;
  data: PublicationListPageData;
  endless: EndlessScrollState;
} = $props();
let filtersOpen = $state(false);
let ready = $state(false);
onMount(() => {
  ready = true;
});
const appliedFilters = $derived(data.filters);
const draft = createFilterDraft(() => publicationFilterValues(appliedFilters));
const advancedCount = $derived(
  publicationFilterIds(draft.values.source).length +
    publicationFilterLevels(draft.values.organizationLevel).length +
    Number(draft.values.fold === "1"),
);
const dirty = $derived(
  Object.entries(publicationFilterValues(appliedFilters)).some(
    ([name, value]) => (draft.values[name] ?? "") !== value,
  ),
);
function change(patch: Record<string, string>) {
  draft.update(patch);
}
function changeType(value: string) {
  if (value === "all" || value === "news" || value === "notice")
    change({ type: value === "all" ? "" : value });
}
function reset() {
  draft.update(publicationFilterValues({}));
  filtersOpen = false;
  void goto("/news", { reset: false });
}
function apply(event: SubmitEvent) {
  // Preserve the native portal submitter until SvelteKit constructs FormData.
  draft.submit(event);
}
const returnHref = $derived(
  publicationListHref(data.filters, data.publications.pagination.page),
);
type PublicationActiveFilter = ActiveFilter & {
  name: "type" | "query" | "source" | "organizationLevel" | "fold";
  value?: string;
  targetAppliedPatch?: Record<string, string>;
};
const activeFilters = $derived<PublicationActiveFilter[]>([
  ...(data.filters.type
    ? [
        {
          name: "type" as const,
          label: data.filters.type === "news" ? copy.news : copy.notice,
          href: publicationListHref({ ...data.filters, type: undefined }),
        },
      ]
    : []),
  ...(data.filters.query
    ? [
        {
          name: "query" as const,
          label: data.filters.query,
          href: publicationListHref({ ...data.filters, query: undefined }),
        },
      ]
    : []),
  ...(data.filters.source ?? []).map((id) => ({
    name: "source" as const,
    value: id,
    targetAppliedPatch: {
      source: (data.filters.source ?? [])
        .filter((item) => item !== id)
        .join(","),
    },
    label: data.sourceOptions.find((source) => source.id === id)?.name ?? id,
    href: publicationListHref({
      ...data.filters,
      source: data.filters.source?.filter((source) => source !== id),
    }),
  })),
  ...(data.filters.organizationLevel ?? []).map((level) => ({
    name: "organizationLevel" as const,
    value: level,
    targetAppliedPatch: {
      organizationLevel: (data.filters.organizationLevel ?? [])
        .filter((item) => item !== level)
        .join(","),
    },
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
          name: "fold" as const,
          label: copy.foldToggle,
          href: publicationListHref({ ...data.filters, fold: undefined }),
        },
      ]
    : []),
]);
function removeFilter(event: MouseEvent, href: string) {
  const filter = activeFilters.find((item) => item.href === href);
  if (!filter) return;
  const value =
    filter.value !== undefined
      ? publicationFilterIds(draft.values[filter.name])
          .filter((item) => item !== filter.value)
          .join(",")
      : "";
  // Compare against the actual target URL value so an explicitly empty source
  // or level draft is not replaced by the target's remaining applied IDs.
  if (draft.remove(event, [filter.name], filter.targetAppliedPatch))
    draft.update({ [filter.name]: value });
}
</script>

<svelte:head><title>{copy.pageTitle} - Life@USTC</title></svelte:head>

{#snippet pagination()}
  <EndlessScroll state={endless} labels={copy.endlessScroll} />
{/snippet}

<CollectionPage description={copy.pageDescription} footer={endless.hasMore ? pagination : undefined} title={copy.pageTitle}>
  {#snippet toolbar()}
    <div class="grid min-w-0 gap-3">
      <form id="publication-filters" method="get" action="/news" onsubmit={apply}>
        {#if draft.values.type}<input type="hidden" name="type" value={draft.values.type} />{/if}
        {#each publicationFilterIds(draft.values.source) as source}<input type="hidden" name="source" value={source} />{/each}
        {#each publicationFilterLevels(draft.values.organizationLevel) as level}<input type="hidden" name="organizationLevel" value={level} />{/each}
        {#if draft.values.fold === "1"}<input type="hidden" name="fold" value="1" />{/if}
        <FilterToolbar filterTitle={copy.advancedFilters} activeCount={advancedCount} bind:open={filtersOpen} disabled={!ready} showFilterLabel advancedBeforeActions>
          {#snippet primary()}
            <div class="w-full min-w-0 md:w-auto md:min-w-64 md:flex-1">
              <SearchField id="publication-query" name="query" label={copy.search} value={draft.values.query ?? ""} oninput={event=>change({query:event.currentTarget.value})} placeholder={copy.searchPlaceholder} maxlength={200} disabled={!ready} />
            </div>
            <Field.Field class="w-full min-w-0 gap-1.5 sm:w-auto">
              <Field.Title>{copy.publicationType}</Field.Title>
              <ToggleGroup.Root type="single" variant="outline" disabled={!ready} bind:value={() => draft.values.type || "all", changeType} aria-label={copy.publicationType}>
                <ToggleGroup.Item value="all" class={toolbarControlClass}>{copy.all}</ToggleGroup.Item>
                <ToggleGroup.Item value="news" class={toolbarControlClass}>{copy.news}</ToggleGroup.Item>
                <ToggleGroup.Item value="notice" class={toolbarControlClass}>{copy.notice}</ToggleGroup.Item>
              </ToggleGroup.Root>
            </Field.Field>
          {/snippet}
          {#snippet advanced()}
            {#await import("./PublicationAdvancedFilters.svelte")}
              <div class="h-6 animate-pulse rounded bg-muted" role="progressbar" aria-label={copy.sourceFilter}></div>
            {:then {default:PublicationAdvancedFilters}}
              <PublicationAdvancedFilters {copy} {data} values={draft.values} onchange={change} onreset={reset} disabled={!ready} formId="publication-filters" />
            {/await}
          {/snippet}
          {#snippet actions()}
            {#if !filtersOpen}
              <Button type="submit" disabled={!ready} class={toolbarControlClass}>{copy.applyFilters}</Button>
              <Button type="button" disabled={!ready} variant="outline" class={toolbarControlClass} onclick={reset}>{copy.clearFilters}</Button>
            {/if}
          {/snippet}
        </FilterToolbar>
      </form>
      {#if dirty}<p class="text-sm text-muted-foreground" role="status">{copy.pendingFilters}</p>{/if}
      {#if activeFilters.length}
        <div class="grid min-w-0 gap-2"><p class="text-sm font-medium">{copy.activeFilters}</p>
          <ActiveFilters items={activeFilters.map(filter=>({...filter,removeLabel:copy.removeFilter.replace("{filter}",()=>filter.label)}))} ariaLabel={copy.activeFilters} clearHref="/news" clearLabel={copy.clearFilters} showClear={false} disabled={!ready} onremove={removeFilter} />
        </div>
      {/if}
      <p class="text-sm text-muted-foreground">{data.filters.fold ? copy.foldedNewestFirst : copy.newestFirst}</p>
    </div>
  {/snippet}

    {#if data.publications.data.length === 0}
      <ResultsEmpty title={data.hasPublications ? copy.noMatchTitle : copy.emptyTitle} description={data.hasPublications ? copy.noMatchDescription : copy.emptyDescription} />
    {:else}
      <ul class="grid min-w-0 divide-y" aria-label={copy.pageTitle}>
        {#each data.publications.data as item (item.id)}
          {@const summary = publicationListSummary(item.revision.title, item.revision.summary)}
          <li class="grid min-w-0 gap-1.5 py-3">
            <h2 class="min-w-0 text-base font-semibold leading-snug [overflow-wrap:anywhere]">
              <a class="hover:underline" href={publicationDetailHref(item.id, returnHref)}>{item.revision.title}</a>
            </h2>
            <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <PublicationTypeBadge type={item.publicationType} {copy} />
              <a class="min-w-0 hover:underline [overflow-wrap:anywhere]" href={publicationListHref({ source: [item.source.id] })}>{item.source.name}</a>
              <span>{copy.organizationLevelLabels[item.source.organizationLevel]}</span>
              {#if item.revision.publishedAt}<span>{formatShanghaiDate(item.revision.publishedAt)}</span>{/if}
              {#if item.revision.updatedAtSource && (!item.revision.publishedAt || formatShanghaiDate(item.revision.updatedAtSource) !== formatShanghaiDate(item.revision.publishedAt))}
                <span>{copy.updatedAt}: {formatShanghaiDate(item.revision.updatedAtSource)}</span>
              {/if}
              {#if item.foldGroup}<Badge variant="secondary">{(item.foldGroup.siblingCount === 1 ? copy.foldSiblingCountOne : copy.foldSiblingCount).replace("{count}", String(item.foldGroup.siblingCount))}</Badge>{/if}
            </div>
            {#if summary}
              <p
                class="min-w-0 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere] {publicationListSummaryIsUrlHeavy(summary)
                  ? 'line-clamp-1'
                  : 'line-clamp-2'}"
              >
                {summary}
              </p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
</CollectionPage>
