<script lang="ts">
import type { Snippet } from "svelte";
import { cn } from "$lib/utils.js";

type Props = {
  children: Snippet;
  class?: string;
  label?: string;
};

let { children, class: className = "", label }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  aria-label={label}
  class={cn(
    "min-w-0 max-w-full overflow-x-auto rounded-lg border bg-card [&>[data-slot=table-container]]:overflow-visible",
    className,
  )}
  role={label ? "region" : undefined}
  data-slot="admin-table-shell"
  tabindex={label ? 0 : undefined}
>
  {@render children()}
</div>
