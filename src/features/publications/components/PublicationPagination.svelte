<script lang="ts">
import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import { Button } from "$lib/components/ui/button/index.js";
import * as Pagination from "$lib/components/ui/pagination/index.js";

export let page: number;
export let pageSize: number;
export let total: number;
export let buildHref: (page: number) => string;
export let previousLabel: string;
export let nextLabel: string;
export let ariaLabel: string;

$: totalPages = Math.ceil(total / pageSize);
</script>

<Pagination.Root
  count={total}
  perPage={pageSize}
  {page}
  siblingCount={1}
  aria-label={ariaLabel}
>
  {#snippet children({ pages, currentPage })}
    <Pagination.Content>
      <Pagination.Item>
        {#if page <= 1}
          <Button variant="ghost" aria-label={previousLabel} disabled>
            <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
            <span class="hidden sm:block">{previousLabel}</span>
          </Button>
        {:else}
          <Button
            href={buildHref(page - 1)}
            variant="ghost"
            aria-label={previousLabel}
          >
            <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
            <span class="hidden sm:block">{previousLabel}</span>
          </Button>
        {/if}
      </Pagination.Item>
      {#each pages as pageItem (pageItem.key)}
        {#if pageItem.type === "ellipsis"}
          <Pagination.Item>
            <Pagination.Ellipsis />
          </Pagination.Item>
        {:else}
          <Pagination.Item>
            <Pagination.Link
              page={pageItem}
              isActive={currentPage === pageItem.value}
            >
              {#snippet child({ props })}
                <a
                  {...props}
                  href={buildHref(pageItem.value)}
                  aria-label={`${ariaLabel} ${pageItem.value}`}
                >
                  {pageItem.value}
                </a>
              {/snippet}
            </Pagination.Link>
          </Pagination.Item>
        {/if}
      {/each}
      <Pagination.Item>
        {#if page >= totalPages}
          <Button variant="ghost" aria-label={nextLabel} disabled>
            <span class="hidden sm:block">{nextLabel}</span>
            <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
        {:else}
          <Button
            href={buildHref(page + 1)}
            variant="ghost"
            aria-label={nextLabel}
          >
            <span class="hidden sm:block">{nextLabel}</span>
            <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
        {/if}
      </Pagination.Item>
    </Pagination.Content>
  {/snippet}
</Pagination.Root>
