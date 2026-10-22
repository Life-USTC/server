<script lang="ts">
import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import PageSectionNav from "#lib/components/PageSectionNav.svelte";
import Panel from "#lib/components/Panel.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import ResultsEmpty from "#lib/components/ResultsEmpty.svelte";
import ResultsSummary from "#lib/components/ResultsSummary.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { Input } from "#lib/components/ui/input/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import { formatShanghaiDate } from "#lib/time/shanghai-format.js";
import { publicationSourceLastPublishedLabel } from "@/features/publications/lib/publication-source-last-published";
import type { PublicationSourceOrganizationLevel } from "@/features/publications/lib/publication-source-levels";
import type {
  PublicationPageCopy,
  PublicationSourceDirectoryPageData,
  PublicationSourceSummary,
} from "./publication-component-types";

type Props = {
  copy: PublicationPageCopy;
  data: PublicationSourceDirectoryPageData;
};

let { copy, data }: Props = $props();
let sourceQuery = $state("");

function levelLabel(level: PublicationSourceOrganizationLevel) {
  return copy.organizationLevelLabels[level] ?? level;
}

function levelHref(level: PublicationSourceOrganizationLevel) {
  return `/news?organizationLevel=${encodeURIComponent(level)}`;
}

function sourceHref(id: string) {
  return `/news?source=${encodeURIComponent(id)}`;
}

function formatLastPublished(source: PublicationSourceSummary) {
  return publicationSourceLastPublishedLabel(
    source.lastPublishedAt,
    source.publicationCount,
    copy.neverPublished,
    formatShanghaiDate,
  );
}

function countSummary(
  template: string,
  sourceCount: number,
  publicationCount: number,
) {
  return template
    .replace(
      "{sources}",
      (sourceCount === 1 ? copy.sourceCountOne : copy.sourceCountOther).replace(
        "{count}",
        String(sourceCount),
      ),
    )
    .replace(
      "{publications}",
      (publicationCount === 1
        ? copy.publicationCountOne
        : copy.publicationCountOther
      ).replace("{count}", String(publicationCount)),
    );
}

function groupSummary(sourceCount: number, publicationCount: number) {
  return countSummary(copy.sourcesGroupSummary, sourceCount, publicationCount);
}

function totalsSummary() {
  return countSummary(
    copy.sourcesTotals,
    data.directory.totals.sourceCount,
    data.directory.totals.publicationCount,
  );
}

function matchesQuery(source: PublicationSourceSummary, query: string) {
  if (!query) return true;
  const haystack = `${source.name} ${source.hosts.join(" ")}`.toLowerCase();
  return haystack.includes(query);
}

const normalizedQuery = $derived(sourceQuery.trim().toLowerCase());
const filteredGroups = $derived(
  data.directory.groups
    .map((group) => {
      const sources = group.sources.filter((source) =>
        matchesQuery(source, normalizedQuery),
      );
      if (sources.length === 0) return null;
      return {
        ...group,
        sources,
        sourceCount: sources.length,
        publicationCount: sources.reduce(
          (total, source) => total + source.publicationCount,
          0,
        ),
      };
    })
    .filter((group) => group !== null),
);
const levelIndex = $derived(filteredGroups);
</script>

<svelte:head>
  <title>{copy.sourcesPageTitle} - Life@USTC</title>
</svelte:head>

<CollectionPage
  density="compact"
  description={copy.sourcesPageDescription}
  panel={false}
  title={copy.sourcesPageTitle}
>
  {#snippet actions()}
        <Button href="/news" variant="outline" size="sm">
          <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
          {copy.backToList}
        </Button>
  {/snippet}

  {#snippet toolbar()}
    {#if data.directory.groups.length > 0}
      <div class="min-w-0 flex-1" data-slot="search-field">
        <label class="sr-only" for="publication-source-directory-query"
          >{copy.searchSources}</label
        >
        <Input
          id="publication-source-directory-query"
          type="search"
          bind:value={sourceQuery}
          placeholder={copy.searchSources}
          maxlength={200}
        />
      </div>
    {/if}
  {/snippet}

  {#if data.directory.groups.length === 0}
    <ResultsEmpty title={copy.sourcesEmptyTitle} description={copy.sourcesEmptyDescription} />
  {:else}
    <ResultsSummary summary={totalsSummary()} />
    {#if levelIndex.length === 0}
      <p class="text-sm text-muted-foreground">{copy.sourceSearchEmpty}</p>
    {:else}
      <PageSectionNav ariaLabel={copy.organizationLevel} items={levelIndex.map((group) => ({ href: `#level-${group.organizationLevel}`, label: levelLabel(group.organizationLevel), meta: group.sourceCount }))} />

      {#each levelIndex as group (group.organizationLevel)}
        <section
          class="grid min-w-0 gap-2 scroll-mt-20"
          id={`level-${group.organizationLevel}`}
        >
          <Panel class="gap-2">
            {#snippet header()}
              <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 class="font-semibold text-base sm:text-lg">
                  {levelLabel(group.organizationLevel)}
                </h2>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span class="text-sm text-muted-foreground">
                    {groupSummary(group.sourceCount, group.publicationCount)}
                  </span>
                  <a
                    class="text-sm text-primary-text underline underline-offset-4"
                    href={levelHref(group.organizationLevel)}
                  >
                    {copy.viewSourceArticles}
                  </a>
                </div>
              </div>
            {/snippet}

            <ResponsiveCollection>
              {#snippet mobile()}
                <Item.Group class="gap-0" role="list">
                  {#each group.sources as source (source.id)}
                    {@const lastPublished = formatLastPublished(source)}
                    <div role="listitem">
                      <Item.Root size="sm" class="py-2">
                        {#snippet child({ props })}
                          <a href={sourceHref(source.id)} {...props}>
                            <Item.Content class="gap-0.5">
                              <Item.Title class="text-sm">{source.name}</Item.Title>
                              <Item.Description class="text-xs [overflow-wrap:anywhere]">{source.hosts.join(" · ")}</Item.Description>
                              <Item.Description class="text-xs">
                                {copy.sourceArticleCount}: {source.publicationCount}
                                {#if lastPublished}
                                  · {copy.lastPublishedAt}: {lastPublished}
                                {/if}
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
                      <Table.Head class="h-9">{copy.source}</Table.Head>
                      <Table.Head class="h-9 w-24 text-right">
                        {copy.sourceArticleCount}
                      </Table.Head>
                      <Table.Head class="h-9 w-32">{copy.lastPublishedAt}</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {#each group.sources as source (source.id)}
                      {@const lastPublished = formatLastPublished(source)}
                      <Table.Row class="has-[a:hover]:bg-muted/50">
                        <Table.Cell class="py-2 align-middle">
                          <a
                            class="font-medium text-sm text-foreground hover:underline [overflow-wrap:anywhere]"
                            href={sourceHref(source.id)}
                          >
                            {source.name}
                          </a>
                          <p class="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                            {source.hosts.join(" · ")}
                          </p>
                        </Table.Cell>
                        <Table.Cell
                          class="py-2 align-middle text-right tabular-nums text-muted-foreground"
                        >
                          {source.publicationCount}
                        </Table.Cell>
                        <Table.Cell
                          class="py-2 align-middle whitespace-nowrap tabular-nums text-muted-foreground"
                        >
                          {lastPublished ?? "—"}
                        </Table.Cell>
                      </Table.Row>
                    {/each}
                  </Table.Body>
                </Table.Root>
              {/snippet}
            </ResponsiveCollection>
          </Panel>
        </section>
      {/each}
    {/if}
  {/if}
</CollectionPage>
