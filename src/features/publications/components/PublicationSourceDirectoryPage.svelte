<script lang="ts">
import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import PageSectionNav from "#lib/components/PageSectionNav.svelte";
import Panel from "#lib/components/Panel.svelte";
import ResultsEmpty from "#lib/components/ResultsEmpty.svelte";
import ResultsSummary from "#lib/components/ResultsSummary.svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
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

  {#if data.directory.groups.length === 0}
    <ResultsEmpty title={copy.sourcesEmptyTitle} description={copy.sourcesEmptyDescription} />
  {:else}
    <ResultsSummary summary={totalsSummary()} />
    {#if levelIndex.length > 0}
      <PageSectionNav ariaLabel={copy.organizationLevel} items={levelIndex.map((group) => ({ href: "#level-" + group.organizationLevel, label: levelLabel(group.organizationLevel), meta: group.sourceCount }))} />
    {/if}
    <Panel>
      <Table.Root containerLabel={copy.sourcesPageTitle} class="table-fixed">
        <colgroup>
          <col />
          <col class="xl:w-24" />
          <col class="xl:w-32" />
        </colgroup>
        <Table.Caption class="sr-only">{copy.sourcesPageTitle}</Table.Caption>
        <Table.Header class="bg-muted/30">
          <TableControlsRow colspan={3}>
            <div class="w-full min-w-0" data-slot="search-field">
              <label class="sr-only" for="publication-source-directory-query">{copy.searchSources}</label>
              <Input id="publication-source-directory-query" type="search" bind:value={sourceQuery} placeholder={copy.searchSources} maxlength={200} />
            </div>
          </TableControlsRow>
          <Table.Row class="hidden xl:table-row">
            <Table.Head class="h-9">{copy.source}</Table.Head>
            <Table.Head class="h-9 w-24 text-right">{copy.sourceArticleCount}</Table.Head>
            <Table.Head class="h-9 w-32">{copy.lastPublishedAt}</Table.Head>
          </Table.Row>
        </Table.Header>
        {#if levelIndex.length === 0}
          <Table.Body>
            <Table.Row><Table.Cell colspan={3}>{copy.sourceSearchEmpty}</Table.Cell></Table.Row>
          </Table.Body>
        {/if}
        {#each levelIndex as group (group.organizationLevel)}
          <Table.Body id={"level-" + group.organizationLevel} class="scroll-mt-20">
            <Table.Row>
              <Table.Head colspan={3} scope="rowgroup" class="h-auto whitespace-normal py-3">
                <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 class="font-semibold text-base sm:text-lg">{levelLabel(group.organizationLevel)}</h2>
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span class="text-sm text-muted-foreground">{groupSummary(group.sourceCount, group.publicationCount)}</span>
                    <a class="text-sm text-primary-text underline underline-offset-4" href={levelHref(group.organizationLevel)}>{copy.viewSourceArticles}</a>
                  </div>
                </div>
              </Table.Head>
            </Table.Row>
            <Table.Row class="xl:hidden">
              <Table.Cell colspan={3} class="p-0">
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
                                {#if lastPublished} · {copy.lastPublishedAt}: {lastPublished}{/if}
                              </Item.Description>
                            </Item.Content>
                          </a>
                        {/snippet}
                      </Item.Root>
                    </div>
                  {/each}
                </Item.Group>
              </Table.Cell>
            </Table.Row>
            {#each group.sources as source (source.id)}
              {@const lastPublished = formatLastPublished(source)}
              <Table.Row class="hidden xl:table-row has-[a:hover]:bg-muted/50" data-publication-source={source.id}>
                <Table.Cell class="py-2 align-middle">
                  <a class="font-medium text-sm text-foreground hover:underline [overflow-wrap:anywhere]" href={sourceHref(source.id)}>{source.name}</a>
                  <p class="text-xs text-muted-foreground [overflow-wrap:anywhere]">{source.hosts.join(" · ")}</p>
                </Table.Cell>
                <Table.Cell class="py-2 align-middle text-right tabular-nums text-muted-foreground">{source.publicationCount}</Table.Cell>
                <Table.Cell class="py-2 align-middle whitespace-nowrap tabular-nums text-muted-foreground">{lastPublished ?? "—"}</Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        {/each}
      </Table.Root>
    </Panel>
  {/if}
</CollectionPage>
