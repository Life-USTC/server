<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";

export let base: string;
export let page: number;
export let pageLabel = "";
export let searchText = "";
export let semesterText = "";
export let totalPages: number;
</script>

<div class="flex flex-wrap items-center justify-between gap-3">
  <p class="text-base-content/60 text-sm">
    {base}
    {#if searchText}
      <span class="font-medium text-base-content">{searchText}</span>
    {/if}
    {#if semesterText}
      <span class="font-medium text-base-content">{semesterText}</span>
    {/if}
  </p>
  <Badge variant="ghost">{pageLabel || `${page} / ${totalPages}`}</Badge>
</div>
