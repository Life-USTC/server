<script lang="ts">
import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import { Button } from "#lib/components/ui/button/index.js";
import * as Pagination from "#lib/components/ui/pagination/index.js";
import { getPaginationTokens } from "#lib/navigation/pagination.js";
import { cn } from "#lib/utils.js";

let {
  ariaLabel,
  nextLabel,
  nextPageLabel,
  page,
  pageHref,
  previousLabel,
  previousPageLabel,
  totalPages,
  class: className = "",
}: {
  ariaLabel: string;
  nextLabel: string;
  nextPageLabel: string;
  page: number;
  pageHref: (targetPage: number) => string;
  previousLabel: string;
  previousPageLabel: string;
  totalPages: number;
  class?: string;
} = $props();

const pages = $derived(getPaginationTokens({ currentPage: page, totalPages }));
</script>

<!-- URL pagination needs links and page tokens, not a second client-side page state. -->
{#if totalPages > 1}
  <nav
    aria-label={ariaLabel}
    class={cn("mx-auto flex w-full justify-center py-0", className)}
    data-slot="list-pagination"
  >
    <Pagination.Content class="flex-wrap justify-center">
      <Pagination.Item>
        <Button
          variant="ghost"
          href={page > 1 ? pageHref(page - 1) : undefined}
          disabled={page <= 1}
          aria-label={previousPageLabel}
        >
          <ChevronLeftIcon aria-hidden="true" />
          <span class="sr-only">{previousLabel}</span>
        </Button>
      </Pagination.Item>
      {#each pages as pageItem, index (index)}
        {#if pageItem === "ellipsis"}
          <Pagination.Item><Pagination.Ellipsis /></Pagination.Item>
        {:else}
          <Pagination.Item>
            <Button
              href={pageHref(pageItem)}
              variant={page === pageItem ? "outline" : "ghost"}
              size="icon"
              aria-current={page === pageItem ? "page" : undefined}
              aria-label={`${ariaLabel} ${pageItem}`}
              data-slot="pagination-link"
              data-value={pageItem}
            >
              {pageItem}
            </Button>
          </Pagination.Item>
        {/if}
      {/each}
      <Pagination.Item>
        <Button
          variant="ghost"
          href={page < totalPages ? pageHref(page + 1) : undefined}
          disabled={page >= totalPages}
          aria-label={nextPageLabel}
        >
          <ChevronRightIcon aria-hidden="true" />
          <span class="sr-only">{nextLabel}</span>
        </Button>
      </Pagination.Item>
    </Pagination.Content>
  </nav>
{/if}
