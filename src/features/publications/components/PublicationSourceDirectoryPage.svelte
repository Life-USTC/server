<script lang="ts">
import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
import {
  PUBLICATION_SOURCE_ORGANIZATION_LEVELS,
  type PublicationSourceOrganizationLevel,
} from "@/features/publications/lib/publication-source-levels";
import PageHeader from "$lib/components/PageHeader.svelte";
import ResponsiveCollection from "$lib/components/ResponsiveCollection.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import { formatShanghaiDate } from "$lib/time/shanghai-format";
import type {
  PublicationPageCopy,
  PublicationSourceDirectoryPageData,
} from "./publication-component-types";

type Props = {
  copy: PublicationPageCopy;
  data: PublicationSourceDirectoryPageData;
};

let { copy, data }: Props = $props();

function levelLabel(level: PublicationSourceOrganizationLevel) {
  return copy.organizationLevelLabels[level] ?? level;
}

function levelHref(level: PublicationSourceOrganizationLevel) {
  return `/news?organizationLevel=${encodeURIComponent(level)}`;
}

function sourceHref(id: string) {
  return `/news?source=${encodeURIComponent(id)}`;
}

function formatLastPublished(value: Date | string | null) {
  return value ? formatShanghaiDate(value) : copy.neverPublished;
}

function groupSummary(sourceCount: number, publicationCount: number) {
  return copy.sourcesGroupSummary
    .replace("{sources}", String(sourceCount))
    .replace("{publications}", String(publicationCount));
}

function totalsSummary() {
  return copy.sourcesTotals
    .replace("{sources}", String(data.directory.totals.sourceCount))
    .replace("{publications}", String(data.directory.totals.publicationCount));
}

// Level anchors double as an in-page table of contents and as the levels the
// list page can be filtered down to.
const levelIndex = $derived(
  PUBLICATION_SOURCE_ORGANIZATION_LEVELS.flatMap((level) => {
    const group = data.directory.groups.find(
      (candidate) => candidate.organizationLevel === level,
    );
    return group ? [group] : [];
  }),
);
</script>

<svelte:head>
  <title>{copy.sourcesPageTitle} - Life@USTC</title>
</svelte:head>

<section class="grid gap-5">
  <PageHeader
    title={copy.sourcesPageTitle}
    description={copy.sourcesPageDescription}
  >
    {#snippet actions()}
      <Button href="/news" variant="outline">
        <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
        {copy.backToList}
      </Button>
    {/snippet}
  </PageHeader>

  {#if data.directory.groups.length === 0}
    <Empty.Root class="rounded-xl border bg-card py-12">
      <Empty.Header>
        <Empty.Title>{copy.sourcesEmptyTitle}</Empty.Title>
        <Empty.Description>{copy.sourcesEmptyDescription}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <p class="text-sm text-muted-foreground">{totalsSummary()}</p>

    <nav aria-label={copy.organizationLevel} class="flex flex-wrap gap-2">
      {#each levelIndex as group (group.organizationLevel)}
        <a
          class="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm hover:bg-muted/50"
          href={`#level-${group.organizationLevel}`}
        >
          {levelLabel(group.organizationLevel)}
          <span class="tabular-nums text-muted-foreground">{group.sourceCount}</span>
        </a>
      {/each}
    </nav>

    {#each levelIndex as group (group.organizationLevel)}
      <section
        class="grid min-w-0 gap-3 scroll-mt-20"
        id={`level-${group.organizationLevel}`}
      >
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="font-semibold text-xl">
            {levelLabel(group.organizationLevel)}
          </h2>
          <div class="flex flex-wrap items-center gap-3">
            <span class="text-sm text-muted-foreground">
              {groupSummary(group.sourceCount, group.publicationCount)}
            </span>
            <a
              class="text-sm text-primary hover:underline"
              href={levelHref(group.organizationLevel)}
            >
              {copy.viewSourceArticles}
            </a>
          </div>
        </div>

        <ResponsiveCollection>
          {#snippet mobile()}
            <Item.Group class="gap-0" role="list">
              {#each group.sources as source (source.id)}
                <div role="listitem">
                  <Item.Root size="sm">
                    {#snippet child({ props })}
                      <a href={sourceHref(source.id)} {...props}>
                        <Item.Content>
                          <Item.Title>{source.name}</Item.Title>
                          <Item.Description>
                            {copy.sourceArticleCount}: {source.publicationCount}
                            · {copy.lastPublishedAt}:
                            {formatLastPublished(source.lastPublishedAt)}
                          </Item.Description>
                        </Item.Content>
                      </a>
                    {/snippet}
                  </Item.Root>
                </div>
              {/each}
            </Item.Group>
          {/snippet}

          {#snippet desktop()}
            <div class="min-w-0 rounded-xl border bg-card">
              <Table.Root
                containerLabel={levelLabel(group.organizationLevel)}
                class="table-fixed"
              >
                <Table.Caption class="sr-only">
                  {levelLabel(group.organizationLevel)} —
                  {groupSummary(group.sourceCount, group.publicationCount)}
                </Table.Caption>
                <Table.Header class="bg-muted/30">
                  <Table.Row>
                    <Table.Head>{copy.source}</Table.Head>
                    <Table.Head class="w-64">{copy.sourceHosts}</Table.Head>
                    <Table.Head class="w-28 text-right">
                      {copy.sourceArticleCount}
                    </Table.Head>
                    <Table.Head class="w-36">{copy.lastPublishedAt}</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {#each group.sources as source (source.id)}
                    <Table.Row class="has-[a:hover]:bg-muted/50">
                      <Table.Cell class="align-top">
                        <a
                          class="font-medium text-foreground hover:underline"
                          href={sourceHref(source.id)}
                        >
                          {source.name}
                        </a>
                        <p class="mt-0.5 font-mono text-xs text-muted-foreground">
                          {source.id}
                        </p>
                      </Table.Cell>
                      <Table.Cell class="align-top">
                        <div class="flex flex-wrap gap-1">
                          {#each source.hosts as host (host)}
                            <Badge variant="outline" class="font-mono text-xs">
                              {host}
                            </Badge>
                          {/each}
                        </div>
                      </Table.Cell>
                      <Table.Cell
                        class="align-top text-right tabular-nums text-muted-foreground"
                      >
                        {source.publicationCount}
                      </Table.Cell>
                      <Table.Cell
                        class="align-top whitespace-nowrap tabular-nums text-muted-foreground"
                      >
                        {formatLastPublished(source.lastPublishedAt)}
                      </Table.Cell>
                    </Table.Row>
                  {/each}
                </Table.Body>
              </Table.Root>
            </div>
          {/snippet}
        </ResponsiveCollection>
      </section>
    {/each}
  {/if}
</section>
