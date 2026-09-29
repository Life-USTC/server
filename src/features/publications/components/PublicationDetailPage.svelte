<script lang="ts">
import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
import {
  publicationDetailHref,
  publicationReturnHref,
} from "@/features/publications/lib/publication-page-navigation";
import { publicationSummary } from "@/features/publications/lib/publication-summary";
import { page } from "$app/stores";
import CollectionPage from "$lib/components/CollectionPage.svelte";
import RenderedMarkdown from "$lib/components/RenderedMarkdown.svelte";
import { Button } from "$lib/components/ui/button";
import * as Collapsible from "$lib/components/ui/collapsible";
import { Separator } from "$lib/components/ui/separator";
import { formatShanghaiDate } from "$lib/time/shanghai-format";
import PublicationTypeBadge from "./PublicationTypeBadge.svelte";
import type {
  PublicationDetailPageData,
  PublicationPageCopy,
} from "./publication-component-types";

let {
  data,
  copy,
}: { data: PublicationDetailPageData; copy: PublicationPageCopy } = $props();
const publication = $derived(data.publication);
const revision = $derived(publication.revision);
const attachments = $derived(
  revision.objects.filter((object) => object.kind === "asset"),
);
const returnHref = $derived(
  publicationReturnHref($page.url.searchParams.get("from")),
);
const summary = $derived(
  publicationSummary(revision.title, revision.summary, revision.bodyMarkdown),
);
const articleInformation = $derived(
  [
    [copy.author, revision.author],
    [
      copy.reporter,
      revision.reporter !== revision.author ? revision.reporter : null,
    ],
    [copy.editor, revision.editor],
    [copy.originalPublisher, revision.originalPublisher],
    [copy.category, revision.category],
  ].filter((entry) => entry[1]),
);
</script>

<svelte:head><title>{revision.title} - {copy.title}</title></svelte:head>

{#snippet externalLink(className = "", placement = "")}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="lucide {className}"
    data-icon={placement || undefined}
    aria-hidden="true"
  >
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
{/snippet}

<CollectionPage
  headerClass="min-w-0"
  title={revision.title}
  titleClass="[overflow-wrap:anywhere]"
  width="reading"
>
  {#snippet lead()}
      <nav aria-label={copy.backToList}>
        <Button href={returnHref} variant="ghost" size="sm"><ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />{copy.backToList}</Button>
      </nav>
  {/snippet}
  {#snippet eyebrowContent()}<PublicationTypeBadge type={publication.publicationType} {copy} />{/snippet}
  {#snippet belowTitle()}
          <div class="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
            <a class="min-w-0 hover:underline" href={`/news?source=${encodeURIComponent(publication.source.id)}`}>{publication.source.name}</a>
            {#if revision.publishedAt}<span>{copy.publishedAt}: {formatShanghaiDate(revision.publishedAt)}</span>{/if}
            {#if revision.updatedAtSource && (!revision.publishedAt || formatShanghaiDate(revision.updatedAtSource) !== formatShanghaiDate(revision.publishedAt))}
              <span>{copy.updatedAt}: {formatShanghaiDate(revision.updatedAtSource)}</span>
            {/if}
          </div>
          {#if revision.sourcePageUrl}
            <Button class="mt-3" href={revision.sourcePageUrl} variant="outline" size="sm" target="_blank" rel="noreferrer noopener">
              {copy.sourcePage}{@render externalLink("", "inline-end")}
            </Button>
          {/if}
          {#if summary.length > 160}
            <Collapsible.Root class="mt-3 min-w-0">
              <Collapsible.Trigger class="text-sm text-muted-foreground underline underline-offset-4">{copy.showSummary}</Collapsible.Trigger>
              <Collapsible.Content><p class="mt-3 min-w-0 max-w-prose text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{summary}</p></Collapsible.Content>
            </Collapsible.Root>
          {:else if summary}
            <p class="mt-4 min-w-0 max-w-prose text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{summary}</p>
          {/if}
  {/snippet}

    <div class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      <RenderedMarkdown class="publication-body min-w-0 text-base" html={data.renderedBodyHtml} emptyLabel={copy.noBody} />
      {#if attachments.length > 0}
        <Separator />
        <section class="grid min-w-0 gap-3" aria-label={copy.attachments}>
          <h2 class="text-lg font-semibold">{copy.attachments}</h2>
          <ul class="grid min-w-0 gap-3">
            {#each attachments as object, index (`${object.kind}:${object.sha256}`)}
              <li class="min-w-0">
                <a class="inline-flex max-w-full min-w-0 flex-wrap items-center gap-2 text-primary hover:underline" href={object.url} download={object.filename ?? true}>
                  <span class="min-w-0 [overflow-wrap:anywhere]">{object.filename || object.altText || copy.attachmentNumber.replace("{number}", String(index + 1))}</span>
                  <span class="text-xs text-muted-foreground [overflow-wrap:anywhere]">{object.contentType} · {Math.ceil(object.size / 1024)} KB</span>
                  {@render externalLink("size-4 shrink-0")}
                </a>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
      {#if articleInformation.length > 0}
        <Separator />
        <section class="grid min-w-0 gap-3" aria-label={copy.articleInformation}>
          <h2 class="text-base font-semibold">{copy.articleInformation}</h2>
          <dl class="grid min-w-0 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {#each articleInformation as [label, value] (label)}
              <div class="flex min-w-0 flex-wrap gap-x-2"><dt>{label}</dt><dd class="min-w-0 [overflow-wrap:anywhere]">{value}</dd></div>
            {/each}
          </dl>
        </section>
      {/if}
      {#if publication.alsoPublishedIn.length > 0}
        <Separator />
        <section class="grid min-w-0 gap-3" aria-label={copy.alsoPublishedIn}>
          <h2 class="text-base font-semibold">{copy.alsoPublishedIn}</h2>
          <ul class="grid min-w-0 gap-2">
            {#each publication.alsoPublishedIn as sibling (sibling.id)}
              <li class="min-w-0"><a class="text-sm text-primary hover:underline [overflow-wrap:anywhere]" href={publicationDetailHref(sibling.id, returnHref)}>{sibling.source.name}</a></li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
</CollectionPage>
