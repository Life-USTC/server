<script lang="ts">
import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import * as Pagination from "$lib/components/ui/pagination/index.js";
import { cn } from "$lib/utils.js";

export let ariaLabel: string;
export let nextLabel: string;
export let nextPageLabel: string;
export let page: number;
export let pageHref: (targetPage: number) => string;
export let previousLabel: string;
export let previousPageLabel: string;
export let totalPages: number;

let className = "";

export { className as class };
</script>

<!-- Links own navigation; omit the primitive button handlers so Enter and modified clicks retain native behavior. -->
{#if totalPages > 1}
  <Pagination.Root
    aria-label={ariaLabel}
    class={cn("py-0", className)}
    count={totalPages}
    data-slot="list-pagination"
    page={page}
    perPage={1}
  >
    {#snippet children({ pages })}
      <Pagination.Content>
        <Pagination.Item>
          {#if page <= 1}
            <Pagination.PrevButton aria-label={previousPageLabel} disabled>
              <ChevronLeftIcon aria-hidden="true" />
              <span class="sr-only">{previousLabel}</span>
            </Pagination.PrevButton>
          {:else}
          <Pagination.PrevButton
            aria-label={previousPageLabel}
          >
            {#snippet child({ props })}
              <a
                {...props}
                onclick={undefined}
                onkeydown={undefined}
                href={pageHref(page - 1)}
                aria-label={previousPageLabel}
              >
                <ChevronLeftIcon aria-hidden="true" />
                <span class="sr-only">{previousLabel}</span>
              </a>
            {/snippet}
          </Pagination.PrevButton>
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
                isActive={page === pageItem.value}
                page={pageItem}
              >
                {#snippet child({ props })}
                  <a
                    {...props}
                    onclick={undefined}
                    onkeydown={undefined}
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
          {#if page >= totalPages}
            <Pagination.NextButton aria-label={nextPageLabel} disabled>
              <ChevronRightIcon aria-hidden="true" />
              <span class="sr-only">{nextLabel}</span>
            </Pagination.NextButton>
          {:else}
          <Pagination.NextButton
            aria-label={nextPageLabel}
          >
            {#snippet child({ props })}
              <a
                {...props}
                onclick={undefined}
                onkeydown={undefined}
                href={pageHref(page + 1)}
                aria-label={nextPageLabel}
              >
                <ChevronRightIcon aria-hidden="true" />
                <span class="sr-only">{nextLabel}</span>
              </a>
            {/snippet}
          </Pagination.NextButton>
          {/if}
        </Pagination.Item>
      </Pagination.Content>
    {/snippet}
  </Pagination.Root>
{/if}
