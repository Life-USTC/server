<script lang="ts">
import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import { goto } from "$app/navigation";
import * as Pagination from "$lib/components/ui/pagination/index.js";

export let page: number;
export let pageSize: number;
export let total: number;
export let buildHref: (page: number) => string;
export let previousLabel: string;
export let nextLabel: string;
export let ariaLabel: string;

function handlePageChange(nextPage: number) {
  if (nextPage !== page) void goto(buildHref(nextPage));
}
</script>

<Pagination.Root
  count={total}
  perPage={pageSize}
  bind:page
  siblingCount={1}
  onPageChange={handlePageChange}
  aria-label={ariaLabel}
>
  {#snippet children({ pages, currentPage })}
    <Pagination.Content>
      <Pagination.Item>
        <Pagination.Previous
          aria-label={previousLabel}
          disabled={page <= 1}
        >
          {#snippet children()}
            <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
            <span class="hidden sm:block">{previousLabel}</span>
          {/snippet}
        </Pagination.Previous>
      </Pagination.Item>
      {#each pages as item (item.key)}
        {#if item.type === "ellipsis"}
          <Pagination.Item>
            <Pagination.Ellipsis />
          </Pagination.Item>
        {:else}
          <Pagination.Item>
            <Pagination.Link
              page={item}
              isActive={currentPage === item.value}
            />
          </Pagination.Item>
        {/if}
      {/each}
      <Pagination.Item>
        <Pagination.Next
          aria-label={nextLabel}
          disabled={page >= Math.ceil(total / pageSize)}
        >
          {#snippet children()}
            <span class="hidden sm:block">{nextLabel}</span>
            <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
          {/snippet}
        </Pagination.Next>
      </Pagination.Item>
    </Pagination.Content>
  {/snippet}
</Pagination.Root>
