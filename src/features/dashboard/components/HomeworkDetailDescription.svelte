<script lang="ts">
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import type {
  DashboardHomeworkDetailCopy,
  DashboardHomeworkDetailItem,
} from "./dashboard-homework-detail-types";

export let homework: DashboardHomeworkDetailItem;
export let homeworksCopy: DashboardHomeworkDetailCopy;
</script>

<section class="min-w-0 text-sm leading-6">
  {#if homework.description}
    <MarkdownPreview
      content={homework.description}
      remarkPlugins={campusReferenceMarkdownPlugins}
    />
  {:else}
    <p class="text-muted-foreground">{homeworksCopy.descriptionEmpty}</p>
  {/if}
</section>
