<script lang="ts">
import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import * as Pagination from "$lib/components/ui/pagination/index.js";

export let ariaLabel: string;
export let nextLabel: string;
export let nextPageLabel: string;
export let page: number;
export let pageHref: (targetPage: number) => string;
export let previousLabel: string;
export let previousPageLabel: string;
export let totalPages: number;
</script>

{#if totalPages > 1}
  <Pagination.Root
    aria-label={ariaLabel}
    class="py-5"
    count={totalPages}
    data-testid="catalog-pagination"
    page={page}
    perPage={1}
  >
    {#snippet children({ pages, currentPage })}
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.PrevButton
            aria-label={previousPageLabel}
            disabled={page <= 1}
          >
            {#snippet child({ props })}
              <a
                {...props}
                href={page <= 1 ? undefined : pageHref(page - 1)}
                aria-label={previousPageLabel}
                aria-disabled={page <= 1 ? "true" : undefined}
                tabindex={page <= 1 ? -1 : undefined}
              >
                <ChevronLeftIcon aria-hidden="true" />
                <span class="sr-only">{previousLabel}</span>
              </a>
            {/snippet}
          </Pagination.PrevButton>
        </Pagination.Item>

        {#each pages as pageItem (pageItem.key)}
          {#if pageItem.type === "ellipsis"}
            <Pagination.Item>
              <Pagination.Ellipsis />
            </Pagination.Item>
          {:else}
            <Pagination.Item>
              <Pagination.Link
                isActive={currentPage === pageItem.value}
                page={pageItem}
              >
                {#snippet child({ props })}
                  <a
                    {...props}
                    href={pageHref(pageItem.value)}
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
          <Pagination.NextButton
            aria-label={nextPageLabel}
            disabled={page >= totalPages}
          >
            {#snippet child({ props })}
              <a
                {...props}
                href={page >= totalPages ? undefined : pageHref(page + 1)}
                aria-label={nextPageLabel}
                aria-disabled={page >= totalPages ? "true" : undefined}
                tabindex={page >= totalPages ? -1 : undefined}
              >
                <ChevronRightIcon aria-hidden="true" />
                <span class="sr-only">{nextLabel}</span>
              </a>
            {/snippet}
          </Pagination.NextButton>
        </Pagination.Item>
      </Pagination.Content>
    {/snippet}
  </Pagination.Root>
{/if}
