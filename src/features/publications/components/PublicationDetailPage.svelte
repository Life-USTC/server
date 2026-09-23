<script lang="ts">
import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
import PageHeader from "$lib/components/PageHeader.svelte";
import RenderedMarkdown from "$lib/components/RenderedMarkdown.svelte";
import * as Card from "$lib/components/ui/card/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import { formatShanghaiDate } from "$lib/time/shanghai-format";
import PublicationTypeBadge from "./PublicationTypeBadge.svelte";
import type {
  PublicationDetailPageData,
  PublicationPageCopy,
} from "./publication-component-types";

export let data: PublicationDetailPageData;
export let copy: PublicationPageCopy;

$: publication = data.publication;
$: revision = publication.revision;
$: attachments = revision.objects.filter((object) => object.kind === "asset");

function formatDate(value: Date | string | null) {
  return value ? formatShanghaiDate(value) : copy.missingDate;
}

function objectLabel(kind: string) {
  return copy.objectLabels[kind] ?? kind;
}
</script>

<svelte:head>
  <title>{revision.title} - {copy.title}</title>
</svelte:head>

<section class="grid gap-5">
  <PageHeader
    title={revision.title}
    description={revision.summary ?? ""}
  >
    {#snippet eyebrowContent()}
      <PublicationTypeBadge type={publication.publicationType} {copy} />
    {/snippet}
    {#snippet belowTitle()}
      <div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{publication.source.name}</span>
        <Separator orientation="vertical" class="h-4" />
        <span>{copy.publishedAt}: {formatDate(revision.publishedAt)}</span>
      </div>
    {/snippet}
  </PageHeader>

  <Card.Root>
    <Card.Content class="grid gap-6 pt-6">
      <RenderedMarkdown
        class="publication-body"
        html={data.renderedBodyHtml}
        emptyLabel={copy.noBody}
      />

      {#if attachments.length > 0}
        <Separator />
        <div class="grid gap-3" aria-label={copy.attachments}>
          <h2 class="text-lg font-semibold">{copy.attachments}</h2>
          <ul class="grid gap-2">
            {#each attachments as object (`${object.kind}:${object.sha256}`)}
              <li>
                <a
                  class="inline-flex max-w-full items-center gap-2 truncate text-primary hover:underline"
                  href={object.url}
                  download
                >
                  <span class="truncate">{objectLabel(object.kind)} · {object.sha256.slice(0, 12)}</span>
                  <ExternalLinkIcon data-icon="inline-end" aria-hidden="true" />
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if publication.alsoPublishedIn.length > 0}
        <Separator />
        <div class="grid gap-3" aria-label={copy.alsoPublishedIn}>
          <h2 class="text-lg font-semibold">{copy.alsoPublishedIn}</h2>
          <ul class="grid gap-2">
            {#each publication.alsoPublishedIn as sibling (sibling.id)}
              <li>
                <a
                  class="inline-flex max-w-full items-center gap-2 truncate text-primary hover:underline"
                  href={`/news/${sibling.id}`}
                >
                  <span class="truncate">{sibling.source.name}</span>
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </Card.Content>
    <Card.Footer class="flex flex-wrap items-center justify-between gap-3">
      <a class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline" href="/news">
        <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
        {copy.backToList}
      </a>
      {#if revision.sourcePageUrl}
        <a
          class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          href={revision.sourcePageUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          {copy.sourcePage}
          <ExternalLinkIcon data-icon="inline-end" aria-hidden="true" />
        </a>
      {/if}
    </Card.Footer>
  </Card.Root>
</section>
