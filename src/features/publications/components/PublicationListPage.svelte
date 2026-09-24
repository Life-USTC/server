<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import type { PublicationSourceOrganizationLevel } from "@/features/publications/lib/publication-source-levels";
import PageHeader from "$lib/components/PageHeader.svelte";
import ResponsiveCollection from "$lib/components/ResponsiveCollection.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import { formatShanghaiDate } from "$lib/time/shanghai-format";
import PublicationPagination from "./PublicationPagination.svelte";
import PublicationTypeBadge from "./PublicationTypeBadge.svelte";
import type {
  PublicationListPageData,
  PublicationPageCopy,
} from "./publication-component-types";

type Props = {
  copy: PublicationPageCopy;
  data: PublicationListPageData;
};

let { copy, data }: Props = $props();

function formatDate(value: Date | string | null) {
  return value ? formatShanghaiDate(value) : copy.missingDate;
}

function isSelectedSource(id: string) {
  return (data.filters.source ?? []).includes(id);
}

function isSelectedLevel(level: PublicationSourceOrganizationLevel) {
  return (data.filters.organizationLevel ?? []).includes(level);
}

function hasActiveFilters() {
  return Boolean(
    data.filters.type ||
      data.filters.source?.length ||
      data.filters.organizationLevel?.length ||
      data.filters.query ||
      data.filters.fold,
  );
}

/**
 * Pagination links must carry every active filter, and the multi-valued ones
 * use the comma form so one link stays one parameter per facet.
 */
function buildPageHref(page: number) {
  const params = new URLSearchParams();
  if (data.filters.type) params.set("type", data.filters.type);
  if (data.filters.source?.length) {
    params.set("source", data.filters.source.join(","));
  }
  if (data.filters.organizationLevel?.length) {
    params.set("organizationLevel", data.filters.organizationLevel.join(","));
  }
  if (data.filters.query) params.set("query", data.filters.query);
  if (data.filters.fold) params.set("fold", "1");
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/news?${search}` : "/news";
}

function sourceHref(id: string) {
  return `/news?source=${encodeURIComponent(id)}`;
}

// Only levels that actually have a selectable source are offered, so the
// filter never shows a checkbox that can only ever return nothing. The
// options arrive ordered by level, so first-seen order is the registry's
// own order and the client needs no copy of the level vocabulary.
const availableLevels = $derived([
  ...new Set(data.sourceOptions.map((option) => option.organizationLevel)),
]);

function resultCount() {
  return copy.resultsCount.replace(
    "{count}",
    String(data.publications.pagination.total),
  );
}
</script>

<svelte:head>
  <title>{copy.pageTitle} - Life@USTC</title>
</svelte:head>

<section class="grid gap-5">
  <PageHeader title={copy.pageTitle} description={copy.pageDescription}>
    {#snippet actions()}
      <Button href="/news/sources" variant="outline">{copy.sourcesTitle}</Button>
    {/snippet}
  </PageHeader>

  <form
    method="get"
    action="/news"
    class="grid gap-4 rounded-xl border bg-card p-4"
  >
    <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-end">
      <Field.Field class="min-w-0 gap-1">
        <Field.Label for="publication-query">{copy.search}</Field.Label>
        <Input
          id="publication-query"
          name="query"
          type="search"
          value={data.filters.query ?? ""}
          placeholder={copy.searchPlaceholder}
          maxlength={200}
        />
      </Field.Field>

      <Field.Field class="min-w-0 gap-1">
        <Field.Label for="publication-type">{copy.publicationType}</Field.Label>
        <NativeSelect.Root
          id="publication-type"
          name="type"
          value={data.filters.type ?? ""}
          aria-label={copy.publicationType}
        >
          <NativeSelect.Option value="">{copy.all}</NativeSelect.Option>
          <NativeSelect.Option value="news">{copy.news}</NativeSelect.Option>
          <NativeSelect.Option value="notice">{copy.notice}</NativeSelect.Option>
        </NativeSelect.Root>
      </Field.Field>

      <div class="flex flex-wrap items-center gap-2">
        <Button type="submit">
          <SearchIcon data-icon="inline-start" aria-hidden="true" />
          {copy.applyFilters}
        </Button>
        {#if hasActiveFilters()}
          <Button href="/news" variant="ghost">{copy.clearFilters}</Button>
        {/if}
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-start">
      <Field.Field class="min-w-0 gap-1">
        <Field.Label for="publication-source">{copy.sourceFilter}</Field.Label>
        {#if data.sourceOptions.length === 0}
          <p id="publication-source-hint" class="text-xs text-muted-foreground">
            {copy.sourceFilterEmpty}
          </p>
        {:else}
          <!--
            A native multiple select keeps the whole filter form working without
            JavaScript: it submits one `source` param per selected option, which
            the query schema accepts as the same list as the comma form.
          -->
          <select
            id="publication-source"
            name="source"
            multiple
            size={4}
            aria-describedby="publication-source-hint"
            class="w-full min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {#each data.sourceOptions as option (option.id)}
              <option class="truncate" value={option.id} selected={isSelectedSource(option.id)}>
                {option.name}
              </option>
            {/each}
          </select>
          <p id="publication-source-hint" class="text-xs text-muted-foreground">
            {copy.sourceFilterHint}
          </p>
        {/if}
      </Field.Field>

      {#if availableLevels.length > 0}
        <fieldset class="min-w-0">
          <legend class="mb-1.5 text-sm font-medium">
            {copy.organizationLevelFilter}
          </legend>
          <div class="flex flex-wrap gap-x-4 gap-y-2">
            {#each availableLevels as level (level)}
              <label class="flex items-center gap-1.5 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  name="organizationLevel"
                  value={level}
                  checked={isSelectedLevel(level)}
                  class="size-4 rounded border-input"
                />
                {copy.organizationLevelLabels[level] ?? level}
              </label>
            {/each}
          </div>
        </fieldset>
      {/if}
    </div>

    <label class="flex items-center gap-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        name="fold"
        value="1"
        checked={data.filters.fold ?? false}
        class="size-4 rounded border-input"
      />
      {copy.foldToggle}
    </label>
  </form>

  {#if data.publications.data.length === 0}
    <Empty.Root class="rounded-xl border bg-card py-12">
      <Empty.Header>
        <Empty.Title>{copy.emptyTitle}</Empty.Title>
        <Empty.Description>{copy.emptyDescription}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <p class="text-sm text-muted-foreground">{resultCount()}</p>
    <ResponsiveCollection>
      {#snippet mobile()}
        <ul class="grid gap-3">
          {#each data.publications.data as item (item.id)}
            <li class="grid min-w-0 gap-3 rounded-xl border bg-card p-4">
              <div class="flex flex-wrap items-center gap-2">
                <PublicationTypeBadge type={item.publicationType} {copy} />
                <span class="text-xs text-muted-foreground">{formatDate(item.revision.publishedAt)}</span>
                {#if item.foldGroup}<Badge variant="secondary">{copy.foldSiblingCount.replace("{count}", String(item.foldGroup.siblingCount))}</Badge>{/if}
              </div>
              <a class="break-words font-medium hover:underline" href={`/news/${item.id}`}>{item.revision.title}</a>
              {#if item.revision.summary}<p class="line-clamp-3 text-sm text-muted-foreground">{item.revision.summary}</p>{/if}
              <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <a class="hover:underline" href={sourceHref(item.source.id)}>{item.source.name}</a>
                {#if item.revision.category}<span>{item.revision.category}</span>{/if}
                {#if item.revision.author}<span>{copy.author}: {item.revision.author}</span>{/if}
              </div>
            </li>
          {/each}
        </ul>
      {/snippet}
      {#snippet desktop()}
    <div class="min-w-0 rounded-xl border bg-card">
      <Table.Root containerLabel={copy.pageTitle} class="min-w-[60rem] table-fixed">
        <Table.Caption class="sr-only">{resultCount()}</Table.Caption>
        <Table.Header class="bg-muted/30">
          <Table.Row>
            <Table.Head class="w-24">{copy.publicationType}</Table.Head>
            <Table.Head>{copy.headline}</Table.Head>
            <Table.Head class="w-56">{copy.source}</Table.Head>
            <Table.Head class="w-36">{copy.publishedAt}</Table.Head>
            <Table.Head class="w-36">{copy.updatedAt}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each data.publications.data as item (item.id)}
            <Table.Row class="has-[a:hover]:bg-muted/50">
              <Table.Cell class="align-top">
                <PublicationTypeBadge type={item.publicationType} {copy} />
              </Table.Cell>
              <Table.Cell class="align-top">
                <a
                  class="font-medium text-foreground hover:underline"
                  href={`/news/${item.id}`}
                >
                  {item.revision.title}
                </a>
                {#if item.foldGroup}
                  <Badge variant="secondary">
                    {copy.foldSiblingCount.replace(
                      "{count}",
                      String(item.foldGroup.siblingCount),
                    )}
                  </Badge>
                {/if}
                {#if item.revision.summary}
                  <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {item.revision.summary}
                  </p>
                {/if}
              </Table.Cell>
              <Table.Cell class="align-top text-muted-foreground">
                <a class="hover:underline" href={sourceHref(item.source.id)}>
                  {item.source.name}
                </a>
                <p class="mt-0.5 text-xs">
                  {copy.organizationLevelLabels[item.source.organizationLevel] ??
                    item.source.organizationLevel}
                </p>
              </Table.Cell>
              <Table.Cell class="align-top whitespace-nowrap tabular-nums text-muted-foreground">
                {formatDate(item.revision.publishedAt)}
              </Table.Cell>
              <Table.Cell class="align-top whitespace-nowrap tabular-nums text-muted-foreground">
                {formatDate(item.revision.updatedAtSource)}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
      {/snippet}
    </ResponsiveCollection>

    {#if data.publications.pagination.totalPages > 1}
      <PublicationPagination
        page={data.publications.pagination.page}
        pageSize={data.publications.pagination.pageSize}
        total={data.publications.pagination.total}
        buildHref={buildPageHref}
        previousLabel={copy.previousPage}
        nextLabel={copy.nextPage}
        ariaLabel={copy.pagination}
      />
    {/if}
  {/if}
</section>
