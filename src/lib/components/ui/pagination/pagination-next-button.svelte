<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import { Pagination as PaginationPrimitive } from "bits-ui";
import { buttonVariants } from "$lib/components/ui/button/index.js";
import { cn } from "$lib/utils.js";

let {
  ref = $bindable(null),
  class: className,
  children,
  ...restProps
}: PaginationPrimitive.NextButtonProps = $props();
</script>

{#snippet Fallback()}
  <span>Next</span>
  <ChevronRightIcon class={cn("size-4", className)} />
{/snippet}

<PaginationPrimitive.NextButton
  bind:ref
  aria-label="Go to next page"
  class={cn(buttonVariants({ variant: "ghost" }), "pr-1.5!", className)}
  {...restProps}
>
  {#if children}
    {@render children?.()}
  {:else}
    {@render Fallback()}
  {/if}
</PaginationPrimitive.NextButton>
