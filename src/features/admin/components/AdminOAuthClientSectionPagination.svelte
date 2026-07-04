<script lang="ts">
import * as Pagination from "$lib/components/ui/pagination/index.js";

export let copy: {
  nextPage: string;
  previousPage: string;
};
export let page: number;
export let pageCount: number;
export let status: string;
</script>

{#if pageCount > 1}
  <div class="flex w-full flex-wrap items-center justify-between gap-3">
    <p class="text-muted-foreground text-xs">
      {status}
    </p>
    <Pagination.Root bind:page count={pageCount} perPage={1} class="mx-0 w-auto">
      {#snippet children()}
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.PrevButton>{copy.previousPage}</Pagination.PrevButton>
          </Pagination.Item>
          <Pagination.Item>
            <Pagination.NextButton>{copy.nextPage}</Pagination.NextButton>
          </Pagination.Item>
        </Pagination.Content>
      {/snippet}
    </Pagination.Root>
  </div>
{/if}
