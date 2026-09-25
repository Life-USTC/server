<script lang="ts">
import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
import type { PublicationSourceOrganizationLevel } from "@/features/publications/lib/publication-source-levels";
import PageHeader from "$lib/components/PageHeader.svelte";
import PageLayout from "$lib/components/PageLayout.svelte";
import PageSectionNav from "$lib/components/PageSectionNav.svelte";
import Panel from "$lib/components/Panel.svelte";
import ResponsiveCollection from "$lib/components/ResponsiveCollection.svelte";
import ResultsEmpty from "$lib/components/ResultsEmpty.svelte";
import ResultsSummary from "$lib/components/ResultsSummary.svelte";
import { Button } from "$lib/components/ui/button/index.js";
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

// The service already returns groups in the registry's display order, so the
// anchors and the sections below share that one ordering and the client needs
// no copy of the level vocabulary.
const levelIndex = $derived(data.directory.groups);
</script>

<svelte:head>
  <title>{copy.sourcesPageTitle} - Life@USTC</title>
</svelte:head>

<PageLayout>
  {#snippet header()}
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
  {/snippet}

  {#if data.directory.groups.length === 0}
    <ResultsEmpty title={copy.sourcesEmptyTitle} description={copy.sourcesEmptyDescription} />
  {:else}
    <ResultsSummary summary={totalsSummary()} />
    <PageSectionNav ariaLabel={copy.organizationLevel} items={levelIndex.map((group) => ({ href: `#level-${group.organizationLevel}`, label: levelLabel(group.organizationLevel), meta: group.sourceCount }))} />

    {#each levelIndex as group (group.organizationLevel)}
      <section
        class="grid min-w-0 gap-3 scroll-mt-20"
        id={`level-${group.organizationLevel}`}
      >
        <Panel>
          {#snippet header()}
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
          {/snippet}

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
                          class="font-medium text-foreground hover:underline [overflow-wrap:anywhere]"
                          href={sourceHref(source.id)}
                        >
                          {source.name}
                        </a>
                        <p class="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          {source.hosts.join(" · ")}
                        </p>
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
            {/snippet}
          </ResponsiveCollection>
        </Panel>
      </section>
    {/each}
  {/if}
</PageLayout>
