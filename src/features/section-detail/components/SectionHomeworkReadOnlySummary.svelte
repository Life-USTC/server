<script lang="ts">
import HomeworkDetailTags from "@/features/homeworks/components/HomeworkDetailTags.svelte";
import HomeworkDueSummary from "@/features/homeworks/components/HomeworkDueSummary.svelte";
import HomeworkMetaList from "@/features/homeworks/components/HomeworkMetaList.svelte";
import {
  buildHomeworkDetailTags,
  buildHomeworkDueSummary,
  buildHomeworkMetadataRows,
  homeworkCompletionStatusLabel,
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

$: completed = Boolean(homework.completion);
$: dueSummary = buildHomeworkDueSummary({
  completed,
  dueLabel: homeworkCopy.submissionDue,
  formatDate: fmtDateTime,
  homework,
  statusLabel: homeworkCompletionStatusLabel(completed, {
    completedStatus: homeworkCopy.completedLabel,
    incompleteStatus: homeworkCopy.filterIncomplete,
  }),
});
$: metaRows = buildHomeworkMetadataRows({
  formatDate: fmtDateTime,
  homework,
  labels: homeworkCopy,
});
$: tags = buildHomeworkDetailTags({ homework, labels: homeworkCopy });
</script>

<Item.Root variant="outline" class="items-start">
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

<HomeworkDueSummary summary={dueSummary} />

<HomeworkMetaList rows={metaRows} />

<HomeworkDetailTags {tags} />
