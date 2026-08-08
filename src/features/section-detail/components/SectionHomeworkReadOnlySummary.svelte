<script lang="ts">
import RenderedMarkdown from "$lib/components/RenderedMarkdown.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  SectionHomeworkCopy,
  SectionHomeworkDisplay,
  SectionHomeworkFormatter,
} from "./section-homework-display-types";

export let fmtDateTime: SectionHomeworkFormatter;
export let homework: SectionHomeworkDisplay;
export let homeworkCopy: SectionHomeworkCopy;
</script>

<Item.Root variant="muted" class="min-h-24 items-start p-4">
  <Item.Content>
    {#if homework.description?.content}
      {#if homework.description.renderedHtml}
        <RenderedMarkdown html={homework.description.renderedHtml} />
      {:else}
        {#await Promise.all([
          import("$lib/components/MarkdownPreview.svelte"),
          import("@/features/markdown/lib/campus-reference-markdown"),
        ]) then [previewModule, markdownModule]}
          {@const Preview = previewModule.default}
          <Preview
            content={homework.description.content}
            remarkPlugins={markdownModule.campusReferenceMarkdownPlugins}
          />
        {/await}
      {/if}
    {:else}
      <Item.Description>{homeworkCopy.descriptionEmpty}</Item.Description>
    {/if}
  </Item.Content>
</Item.Root>

<dl class="grid gap-3 sm:grid-cols-3">
  <Item.Root variant="outline" size="sm" class="block bg-background">
    <dt class="text-muted-foreground text-xs">{homeworkCopy.publishedAt}</dt>
    <dd class="mt-1 font-medium text-sm tabular-nums">{fmtDateTime(homework.publishedAt)}</dd>
  </Item.Root>
  <Item.Root variant="outline" size="sm" class="block bg-background">
    <dt class="text-muted-foreground text-xs">{homeworkCopy.submissionStart}</dt>
    <dd class="mt-1 font-medium text-sm tabular-nums">
      {fmtDateTime(homework.submissionStartAt)}
    </dd>
  </Item.Root>
  <Item.Root variant="outline" size="sm" class="block border-primary/30 bg-primary/5">
    <dt class="text-muted-foreground text-xs">{homeworkCopy.submissionDue}</dt>
    <dd class="mt-1 font-semibold text-sm tabular-nums">
      {fmtDateTime(homework.submissionDueAt)}
    </dd>
  </Item.Root>
</dl>

<div class="flex flex-wrap gap-2">
  {#if homework.isMajor}<Badge variant="secondary">{homeworkCopy.tagMajor}</Badge>{/if}
  {#if homework.requiresTeam}<Badge variant="outline">{homeworkCopy.tagTeam}</Badge>{/if}
</div>
