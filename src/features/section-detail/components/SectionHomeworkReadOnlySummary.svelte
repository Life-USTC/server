<script lang="ts">
import HomeworkDetailMetaGrid from "@/features/homeworks/components/HomeworkDetailMetaGrid.svelte";
import HomeworkDetailTags from "@/features/homeworks/components/HomeworkDetailTags.svelte";
import {
  buildHomeworkDetailMetaRows,
  buildHomeworkDetailTags,
} from "@/features/homeworks/lib/homework-detail-meta";
import RenderedMarkdown from "$lib/components/RenderedMarkdown.svelte";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  SectionHomeworkCopy,
  SectionHomeworkDisplay,
  SectionHomeworkFormatter,
} from "./section-homework-display-types";

export let fmtDateTime: SectionHomeworkFormatter;
export let homework: SectionHomeworkDisplay;
export let homeworkCopy: SectionHomeworkCopy;

$: metaRows = buildHomeworkDetailMetaRows({
  formatDate: fmtDateTime,
  homework,
  labels: homeworkCopy,
});
$: tags = buildHomeworkDetailTags({ homework, labels: homeworkCopy });
</script>

<Item.Root variant="muted" class="items-start p-4">
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

<HomeworkDetailMetaGrid rows={metaRows} />

<HomeworkDetailTags {tags} />
