<script lang="ts">
import RenderedMarkdown from "$lib/components/RenderedMarkdown.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import type {
  SectionHomeworkCopy,
  SectionHomeworkDisplay,
  SectionHomeworkFormatter,
} from "./section-homework-display-types";

export let fmtDateTime: SectionHomeworkFormatter;
export let homework: SectionHomeworkDisplay;
export let homeworkCopy: SectionHomeworkCopy;
</script>

<section class="grid gap-6">
  <div class="min-w-0 text-sm leading-6">
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
      <p class="text-muted-foreground">{homeworkCopy.descriptionEmpty}</p>
    {/if}
  </div>

  <div class="grid gap-4 rounded-lg bg-muted/50 px-4 py-4">
    <div>
      <p class="text-muted-foreground text-xs">{homeworkCopy.submissionDue}</p>
      <p class="mt-1 font-semibold text-base">{fmtDateTime(homework.submissionDueAt)}</p>
    </div>
    <dl class="grid gap-3 border-t pt-4 sm:grid-cols-2">
      <div>
        <dt class="text-muted-foreground text-xs">{homeworkCopy.submissionStart}</dt>
        <dd class="mt-1 font-medium text-sm">{fmtDateTime(homework.submissionStartAt)}</dd>
      </div>
      <div>
        <dt class="text-muted-foreground text-xs">{homeworkCopy.publishedAt}</dt>
        <dd class="mt-1 font-medium text-sm">{fmtDateTime(homework.publishedAt)}</dd>
      </div>
    </dl>
    <div class="flex flex-wrap gap-2">
      {#if homework.isMajor}<Badge variant="secondary">{homeworkCopy.tagMajor}</Badge>{/if}
      {#if homework.requiresTeam}<Badge variant="outline">{homeworkCopy.tagTeam}</Badge>{/if}
    </div>
  </div>
</section>
