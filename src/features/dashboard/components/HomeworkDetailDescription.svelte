<script lang="ts">
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import type {
  DashboardHomeworkDetailCopy,
  DashboardHomeworkDetailItem,
} from "./dashboard-homework-detail-types";

export let homework: DashboardHomeworkDetailItem;
export let homeworksCopy: DashboardHomeworkDetailCopy;
</script>

<section class="rounded-md border border-base-300 border-l-4 border-l-primary bg-base-100 p-4">
  {#if homework.description}
    <MarkdownPreview content={homework.description} />
  {:else}
    <p class="text-base-content/60 text-sm">{homeworksCopy.descriptionEmpty}</p>
  {/if}
</section>
