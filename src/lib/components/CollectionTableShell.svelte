<script lang="ts">
import type { Snippet } from "svelte";
import { cn } from "#lib/utils.js";

type Props = {
  children: Snippet;
  class?: string;
  cards?: boolean;
  label?: string;
};

let { children, cards = false, class: className = "", label }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class:cards
  aria-label={label}
  class={cn(
    "min-w-0 max-w-full overflow-x-auto [&>[data-slot=table-container]]:overflow-visible",
    className,
  )}
  role={label ? "region" : undefined}
  data-slot="collection-table-shell"
  tabindex={label ? 0 : undefined}
>
  {@render children()}
</div>

<style>
  @media (width < 80rem) {
    .cards :global(table), .cards :global(thead), .cards :global(tbody) {
      display: block;
      width: 100%;
      min-width: 0;
    }
    .cards :global(thead tr) { display: flex; flex-wrap: wrap; gap: .25rem; }
    .cards :global(th) { width: auto; min-width: 0; height: auto; }
    .cards :global(tbody) { display: grid; gap: .75rem; }
    .cards :global(tbody tr) {
      display: grid;
      gap: .375rem;
      padding: .75rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .cards :global(td) { width: auto; min-width: 0; max-width: 100%; padding: 0; white-space: normal; }
    .cards :global(td[data-label]::before) {
      content: attr(data-label);
      display: block;
      color: var(--muted-foreground);
      font-size: .75rem;
    }
    .cards :global(td > div) { opacity: 1; }
  }
</style>
