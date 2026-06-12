<script lang="ts">
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
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

<div class="rounded-md border border-base-300 bg-base-200/40 p-4">
  {#if homework.description?.content}
    <MarkdownPreview content={homework.description.content} />
  {:else}
    <p class="text-base-content/60 text-sm">{homeworkCopy.descriptionEmpty}</p>
  {/if}
</div>

<dl class="grid gap-3 sm:grid-cols-3">
  <div class="rounded-md border border-base-300 bg-base-100 p-3">
    <dt class="text-base-content/60 text-xs">{homeworkCopy.publishedAt}</dt>
    <dd class="mt-1 font-medium text-sm">{fmtDateTime(homework.publishedAt)}</dd>
  </div>
  <div class="rounded-md border border-base-300 bg-base-100 p-3">
    <dt class="text-base-content/60 text-xs">{homeworkCopy.submissionStart}</dt>
    <dd class="mt-1 font-medium text-sm">{fmtDateTime(homework.submissionStartAt)}</dd>
  </div>
  <div class="rounded-md border border-base-300 bg-base-100 p-3">
    <dt class="text-base-content/60 text-xs">{homeworkCopy.submissionDue}</dt>
    <dd class="mt-1 font-medium text-sm">{fmtDateTime(homework.submissionDueAt)}</dd>
  </div>
</dl>

<div class="flex flex-wrap gap-2">
  {#if homework.isMajor}<Badge class="border-warning/40 bg-warning/10 text-warning">{homeworkCopy.tagMajor}</Badge>{/if}
  {#if homework.requiresTeam}<Badge class="border-info/40 bg-info/10 text-info">{homeworkCopy.tagTeam}</Badge>{/if}
</div>
