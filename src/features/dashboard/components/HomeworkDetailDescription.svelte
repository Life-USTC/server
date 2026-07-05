<script lang="ts">
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  DashboardHomeworkDetailCopy,
  DashboardHomeworkDetailItem,
} from "./dashboard-homework-detail-types";

export let homework: DashboardHomeworkDetailItem;
export let homeworksCopy: DashboardHomeworkDetailCopy;
</script>

<Item.Root variant="outline" class="items-start">
  <Item.Content>
    {#if homework.description}
      <MarkdownPreview
        content={homework.description}
        remarkPlugins={campusReferenceMarkdownPlugins}
      />
    {:else}
      <Item.Description>{homeworksCopy.descriptionEmpty}</Item.Description>
    {/if}
  </Item.Content>
</Item.Root>
