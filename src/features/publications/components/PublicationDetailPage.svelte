<script lang="ts">
import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
import PageHeader from "$lib/components/PageHeader.svelte";
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
$: media = revision.objects.filter(
  (object) =>
    object.kind === "media" && object.contentType.startsWith("image/"),
);
$: attachments = revision.objects.filter((object) => !media.includes(object));

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
      <div class="whitespace-pre-wrap break-words text-base leading-7">
        {revision.bodyText ?? copy.noBody}
      </div>

      {#if media.length > 0}
        <div class="grid gap-3" aria-label={copy.media}>
          <h2 class="text-lg font-semibold">{copy.media}</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            {#each media as object (`${object.kind}:${object.sha256}`)}
              <figure class="grid gap-2">
                <img
                  src={object.url}
                  alt={object.altText ?? `${copy.media} · ${object.sha256.slice(0, 12)}`}
                  loading="lazy"
                  class="max-h-[32rem] w-full rounded-lg border object-contain"
                />
                {#if object.altText}
                  <figcaption class="text-sm text-muted-foreground">{object.altText}</figcaption>
                {/if}
              </figure>
            {/each}
          </div>
        </div>
      {/if}

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
