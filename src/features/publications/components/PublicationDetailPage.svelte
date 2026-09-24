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
        <a class="hover:underline" href={`/news?source=${encodeURIComponent(publication.source.id)}`}>{publication.source.name}</a>
        <Separator orientation="vertical" class="h-4" />
        <span>{copy.publishedAt}: {formatDate(revision.publishedAt)}</span>
        {#if revision.updatedAtSource && formatDate(revision.updatedAtSource) !== formatDate(revision.publishedAt)}
          <span>{copy.updatedAt}: {formatDate(revision.updatedAtSource)}</span>
        {/if}
        {#if revision.author}<span>{copy.author}: {revision.author}</span>{/if}
        {#if revision.reporter && revision.reporter !== revision.author}<span>{copy.reporter}: {revision.reporter}</span>{/if}
        {#if revision.editor}<span>{copy.editor}: {revision.editor}</span>{/if}
        {#if revision.originalPublisher}<span>{copy.originalPublisher}: {revision.originalPublisher}</span>{/if}
        {#if revision.category}<span>{copy.category}: {revision.category}</span>{/if}
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
            {#each attachments as object, index (`${object.kind}:${object.sha256}`)}
              <li>
                <a
                  class="inline-flex max-w-full flex-wrap items-center gap-2 text-primary hover:underline"
                  href={object.url}
                  download={object.filename ?? true}
                >
                  <span class="break-words">{object.filename || object.altText || copy.attachmentNumber.replace("{number}", String(index + 1))}</span>
                  <span class="shrink-0 text-xs text-muted-foreground">{object.contentType} · {Math.ceil(object.size / 1024)} KB</span>
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
                  class="inline-flex max-w-full flex-wrap items-center gap-2 text-primary hover:underline"
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
