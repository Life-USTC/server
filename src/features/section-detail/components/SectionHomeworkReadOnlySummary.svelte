<script lang="ts">
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
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

<Item.Root variant="muted" class="items-start">
  <Item.Content>
    {#if homework.description?.content}
      <MarkdownPreview
        content={homework.description.content}
        remarkPlugins={campusReferenceMarkdownPlugins}
      />
    {:else}
      <Item.Description>{homeworkCopy.descriptionEmpty}</Item.Description>
    {/if}
  </Item.Content>
</Item.Root>

<dl class="grid gap-3 sm:grid-cols-3">
  <Item.Root variant="outline" size="sm" class="block">
    <dt class="text-muted-foreground text-xs">{homeworkCopy.publishedAt}</dt>
    <dd class="mt-1 font-medium text-sm">{fmtDateTime(homework.publishedAt)}</dd>
  </Item.Root>
  <Item.Root variant="outline" size="sm" class="block">
    <dt class="text-muted-foreground text-xs">{homeworkCopy.submissionStart}</dt>
    <dd class="mt-1 font-medium text-sm">{fmtDateTime(homework.submissionStartAt)}</dd>
  </Item.Root>
  <Item.Root variant="outline" size="sm" class="block">
    <dt class="text-muted-foreground text-xs">{homeworkCopy.submissionDue}</dt>
    <dd class="mt-1 font-medium text-sm">{fmtDateTime(homework.submissionDueAt)}</dd>
  </Item.Root>
</dl>

<div class="flex flex-wrap gap-2">
  {#if homework.isMajor}<Badge variant="secondary">{homeworkCopy.tagMajor}</Badge>{/if}
  {#if homework.requiresTeam}<Badge variant="outline">{homeworkCopy.tagTeam}</Badge>{/if}
</div>
