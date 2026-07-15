<script lang="ts">
import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import MoreHorizontalIcon from "@lucide/svelte/icons/more-horizontal";
import { Button } from "$lib/components/ui/button/index.js";
import { getPaginationTokens } from "$lib/navigation/pagination";

export let ariaLabel: string;
export let nextLabel: string;
export let nextPageLabel: string;
export let page: number;
export let pageHref: (targetPage: number) => string;
export let previousLabel: string;
export let previousPageLabel: string;
export let totalPages: number;

$: tokens = getPaginationTokens({
  currentPage: page,
  maxVisible: 3,
  totalPages,
});
</script>

{#if totalPages > 1}
  <nav aria-label={ariaLabel} class="flex justify-center py-5" data-testid="catalog-pagination">
    <ul class="flex items-center gap-0.5">
      <li>
        <Button
          aria-label={previousPageLabel}
          disabled={page <= 1}
          href={pageHref(Math.max(1, page - 1))}
          size="icon"
          variant="ghost"
        >
          <ChevronLeftIcon aria-hidden="true" />
          <span class="sr-only">{previousLabel}</span>
        </Button>
      </li>
      {#each tokens as token}
        <li>
          {#if token === "ellipsis"}
            <span
              aria-hidden="true"
              class="flex size-8 items-center justify-center text-muted-foreground"
            >
              <MoreHorizontalIcon class="size-4" />
            </span>
          {:else}
            <Button
              aria-current={token === page ? "page" : undefined}
              aria-label={`${ariaLabel} ${token}`}
              href={pageHref(token)}
              size="icon"
              variant={token === page ? "outline" : "ghost"}
            >
              {token}
            </Button>
          {/if}
        </li>
      {/each}
      <li>
        <Button
          aria-label={nextPageLabel}
          disabled={page >= totalPages}
          href={pageHref(Math.min(totalPages, page + 1))}
          size="icon"
          variant="ghost"
        >
          <ChevronRightIcon aria-hidden="true" />
          <span class="sr-only">{nextLabel}</span>
        </Button>
      </li>
    </ul>
  </nav>
{/if}
