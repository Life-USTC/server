<script lang="ts">
import type { HomeworkDetailTag } from "@/features/homeworks/lib/homework-detail-meta";
import { Badge } from "$lib/components/ui/badge/index.js";

export let tags: HomeworkDetailTag[];
</script>

{#if tags.length > 0}
  <div class="flex flex-wrap gap-2">
    {#each tags as tag (tag.key)}
      <Badge variant={tag.variant}>{tag.label}</Badge>
    {/each}
  </div>
{/if}
