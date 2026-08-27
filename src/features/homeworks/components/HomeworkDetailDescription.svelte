<script lang="ts">
import type { HomeworkDetailModel } from "@/features/homeworks/lib/homework-presentation";
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import RenderedMarkdown from "$lib/components/RenderedMarkdown.svelte";
import type { HomeworkDetailCopy } from "./homework-detail-types";

export let copy: HomeworkDetailCopy;
export let homework: HomeworkDetailModel;
</script>

<section class="min-w-0 text-sm leading-6" data-testid="homework-description">
  {#if homework.description?.trim()}
    {#if homework.renderedDescriptionHtml}
      <RenderedMarkdown html={homework.renderedDescriptionHtml} />
    {:else}
      <MarkdownPreview
        content={homework.description}
        remarkPlugins={campusReferenceMarkdownPlugins}
      />
    {/if}
  {:else}
    <p class="text-muted-foreground">{copy.descriptionEmpty}</p>
  {/if}
</section>
