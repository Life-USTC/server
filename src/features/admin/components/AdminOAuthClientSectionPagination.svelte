<script lang="ts">
import ChevronLeftIcon from "$lib/components/icons/chevron-left.svelte";
import ChevronRightIcon from "$lib/components/icons/chevron-right.svelte";
import { Button } from "$lib/components/ui/button/index.js";

export let copy: {
  nextPage: string;
  previousPage: string;
};
export let page: number;
export let pageCount: number;
export let status: string;

function setPage(nextPage: number) {
  page = Math.min(Math.max(1, nextPage), pageCount);
}
</script>

{#if pageCount > 1}
  <div class="flex flex-wrap items-center justify-between gap-3 border-base-300 border-t pt-3">
    <p class="text-base-content/60 text-xs">
      {status}
    </p>
    <div class="flex gap-2">
      <Button
        disabled={page <= 1}
        size="sm"
        type="button"
        variant="outline"
        onclick={() => setPage(page - 1)}
      >
        <ChevronLeftIcon />
        <span>{copy.previousPage}</span>
      </Button>
      <Button
        disabled={page >= pageCount}
        size="sm"
        type="button"
        variant="outline"
        onclick={() => setPage(page + 1)}
      >
        <span>{copy.nextPage}</span>
        <ChevronRightIcon />
      </Button>
    </div>
  </div>
{/if}
