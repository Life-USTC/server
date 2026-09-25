<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
import XIcon from "@lucide/svelte/icons/x";
import {
  publicationDetailHref,
  publicationListHref,
} from "@/features/publications/lib/publication-page-navigation";
import { publicationSummary } from "@/features/publications/lib/publication-summary";
import { goto } from "$app/navigation";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Badge } from "$lib/components/ui/badge";
import { Button, buttonVariants } from "$lib/components/ui/button";
import { Checkbox } from "$lib/components/ui/checkbox";
import * as Collapsible from "$lib/components/ui/collapsible";
import * as Empty from "$lib/components/ui/empty";
import * as Field from "$lib/components/ui/field";
import { Input } from "$lib/components/ui/input";
import * as ToggleGroup from "$lib/components/ui/toggle-group";
import { formatShanghaiDate } from "$lib/time/shanghai-format";
import PublicationPagination from "./PublicationPagination.svelte";
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
const availableLevels = $derived([
  ...new Set(data.sourceOptions.map((option) => option.organizationLevel)),
]);
const returnHref = $derived(
  publicationListHref(data.filters, data.publications.pagination.page),
);
const activeFilters = $derived([
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

<section class="grid min-w-0 gap-5">
  <PageHeader title={copy.pageTitle} description={copy.pageDescription}>
    {#snippet actions()}<Button href="/news/sources" variant="outline">{copy.sourcesTitle}</Button>{/snippet}
  </PageHeader>

  <ToggleGroup.Root type="single" variant="outline" bind:value={() => data.filters.type ?? "all", changeType} aria-label={copy.publicationType}>
    <ToggleGroup.Item value="all">{copy.all}</ToggleGroup.Item>
    <ToggleGroup.Item value="news">{copy.news}</ToggleGroup.Item>
    <ToggleGroup.Item value="notice">{copy.notice}</ToggleGroup.Item>
  </ToggleGroup.Root>

  <form method="get" action="/news" class="min-w-0">
    {#if data.filters.type}<input type="hidden" name="type" value={data.filters.type} />{/if}
    <Field.Group class="min-w-0 gap-3">
      <Field.Field orientation="horizontal" class="min-w-0 items-end gap-2">
        <Field.Content class="min-w-0 gap-1">
          <Field.Label for="publication-query" class="sr-only">{copy.search}</Field.Label>
          <Input id="publication-query" name="query" type="search" value={data.filters.query ?? ""} placeholder={copy.searchPlaceholder} maxlength={200} />
        </Field.Content>
        <Button type="submit"><SearchIcon data-icon="inline-start" aria-hidden="true" />{copy.search}</Button>
      </Field.Field>
      <Collapsible.Root bind:open={filtersOpen} class="min-w-0">
        <Collapsible.Trigger class={buttonVariants({ variant: "ghost", size: "sm" })}>
          <SlidersHorizontalIcon data-icon="inline-start" aria-hidden="true" />{copy.advancedFilters}
        </Collapsible.Trigger>
        <div hidden={!filtersOpen}>
          <Collapsible.Content forceMount>
            {#key publicationListHref(data.filters)}
              <Field.Group class="mt-3 min-w-0 gap-4 rounded-xl border bg-card p-4">
                <Field.Group class="grid min-w-0 gap-5 md:grid-cols-2">
                  <PublicationSourceFilter options={data.sourceOptions} selected={data.filters.source ?? []} {copy} />
                  {#if availableLevels.length > 0}
                    <Field.Set class="min-w-0 gap-3">
                      <Field.Legend>{copy.organizationLevelFilter}</Field.Legend>
                      <Field.Group class="gap-3">
                        {#each availableLevels as level (level)}
                          <Field.Field orientation="horizontal" class="gap-2">
                            <Checkbox id={`publication-level-${level}`} name="organizationLevel" value={level} checked={data.filters.organizationLevel?.includes(level) ?? false} />
                            <Field.Label for={`publication-level-${level}`}>{copy.organizationLevelLabels[level]}</Field.Label>
                          </Field.Field>
                        {/each}
                      </Field.Group>
                    </Field.Set>
                  {/if}
                </Field.Group>
                <Field.Field orientation="horizontal" class="gap-2">
                  <Checkbox id="publication-fold" name="fold" value="1" checked={data.filters.fold ?? false} />
                  <Field.Label for="publication-fold">{copy.foldToggle}</Field.Label>
                </Field.Field>
                <Button type="submit" class="self-start">{copy.applyFilters}</Button>
              </Field.Group>
            {/key}
          </Collapsible.Content>
        </div>
      </Collapsible.Root>
    </Field.Group>
  </form>

  {#if activeFilters.length > 0 || data.filters.type}
    <nav aria-label={copy.activeFilters} class="flex min-w-0 flex-wrap items-center gap-2">
      {#each activeFilters as filter (filter.href)}
        <Button href={filter.href} variant="outline" size="sm" class="h-auto max-w-full py-1.5" aria-label={copy.removeFilter.replace("{filter}", filter.label)}>
          <span class="min-w-0 whitespace-normal text-left [overflow-wrap:anywhere]">{filter.label}</span><XIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
      {/each}
      <Button href="/news" variant="ghost" size="sm">{copy.clearFilters}</Button>
    </nav>
  {/if}

  <p class="text-sm text-muted-foreground" aria-live="polite">{resultsCount}</p>
  {#if data.publications.data.length === 0}
    <Empty.Root class="rounded-xl border bg-card py-12">
      <Empty.Header><Empty.Title>{copy.emptyTitle}</Empty.Title><Empty.Description>{copy.emptyDescription}</Empty.Description></Empty.Header>
    </Empty.Root>
  {:else}
    <ul class="grid min-w-0 divide-y rounded-xl border bg-card" aria-label={copy.pageTitle}>
      {#each data.publications.data as item (item.id)}
        {@const summary = publicationSummary(item.revision.title, item.revision.summary)}
        <li class="grid min-w-0 gap-2 p-4 md:px-5 md:py-4">
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
    {#if data.publications.pagination.totalPages > 1}
      <PublicationPagination page={data.publications.pagination.page} pageSize={data.publications.pagination.pageSize} total={data.publications.pagination.total} buildHref={(page) => publicationListHref(data.filters, page)} previousLabel={copy.previousPage} nextLabel={copy.nextPage} ariaLabel={copy.pagination} />
    {/if}
  {/if}
</section>
