<script lang="ts">
import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
import SearchIcon from "@lucide/svelte/icons/search";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import { formatShanghaiDate } from "$lib/time/shanghai-format";
import PublicationPagination from "./PublicationPagination.svelte";
import PublicationTypeBadge from "./PublicationTypeBadge.svelte";
import type {
  PublicationListPageData,
  PublicationPageCopy,
} from "./publication-component-types";

export let data: PublicationListPageData;
export let copy: PublicationPageCopy;

function formatDate(value: Date | string | null) {
  return value ? formatShanghaiDate(value) : copy.missingDate;
}

function buildPageHref(page: number) {
  const params = new URLSearchParams();
  if (data.filters.type) params.set("type", data.filters.type);
  if (data.filters.source) params.set("source", data.filters.source);
  if (data.filters.query) params.set("query", data.filters.query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/news?${search}` : "/news";
}

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
  <PageHeader title={copy.pageTitle} description={copy.pageDescription} />

  <form
    method="get"
    action="/news"
    class="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(10rem,auto)_12rem_auto] md:items-end"
  >
    <Field.Field class="gap-1">
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

    <Field.Field class="gap-1">
      <Field.Label for="publication-source">{copy.sourceId}</Field.Label>
      <Input
        id="publication-source"
        name="source"
        value={data.filters.source ?? ""}
        placeholder="ustc-news"
        maxlength={64}
      />
    </Field.Field>

    <Field.Field class="gap-1">
      <Field.Label for="publication-type">{copy.title}</Field.Label>
      <NativeSelect.Root
        id="publication-type"
        name="type"
        value={data.filters.type ?? ""}
        aria-label={copy.title}
      >
        <NativeSelect.Option value="">{copy.all}</NativeSelect.Option>
        <NativeSelect.Option value="news">{copy.news}</NativeSelect.Option>
        <NativeSelect.Option value="notice">{copy.notice}</NativeSelect.Option>
      </NativeSelect.Root>
    </Field.Field>

    <div class="flex flex-wrap gap-2">
      <Button type="submit">
        <SearchIcon data-icon="inline-start" aria-hidden="true" />
        {copy.applyFilters}
      </Button>
      {#if data.filters.type || data.filters.source || data.filters.query}
        <Button href="/news" variant="ghost">{copy.clearFilters}</Button>
      {/if}
    </div>
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
    <div class="grid gap-4" aria-label={copy.pageTitle}>
      {#each data.publications.data as item (item.id)}
        <Card.Root class="overflow-hidden">
          <Card.Header class="gap-3">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <PublicationTypeBadge type={item.publicationType} {copy} />
              <span class="text-muted-foreground">{item.source.name}</span>
            </div>
            <h2 class="text-xl leading-tight font-medium">
              <a class="hover:underline" href={`/news/${item.id}`}>
                {item.revision.title}
              </a>
            </h2>
            {#if item.revision.summary}
              <Card.Description class="line-clamp-3">
                {item.revision.summary}
              </Card.Description>
            {/if}
          </Card.Header>
          <Card.Content class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{copy.publishedAt}: {formatDate(item.revision.publishedAt)}</span>
            {#if item.revision.updatedAtSource}
              <Separator orientation="vertical" class="h-4" />
              <span>{copy.updatedAt}: {formatDate(item.revision.updatedAtSource)}</span>
            {/if}
          </Card.Content>
          <Card.Footer>
            <a
              class="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              href={`/news/${item.id}`}
            >
              {copy.readMore}
              <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </a>
          </Card.Footer>
        </Card.Root>
      {/each}
    </div>

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
