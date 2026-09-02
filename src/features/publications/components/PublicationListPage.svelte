<script lang="ts">
import SearchIcon from "@lucide/svelte/icons/search";
import PageHeader from "$lib/components/PageHeader.svelte";
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
                {#if item.revision.summary}
                  <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {item.revision.summary}
                  </p>
                {/if}
              </Table.Cell>
              <Table.Cell class="align-top text-muted-foreground">
                {item.source.name}
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
