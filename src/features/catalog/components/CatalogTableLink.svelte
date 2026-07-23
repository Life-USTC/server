<script lang="ts">
import { cn } from "$lib/utils.js";

export let href: string;
export let nowrap = false;
export let numeric = false;

let className = "";

export { className as class };
</script>

<a
  class={cn(
    "block h-full min-w-0 w-full overflow-hidden p-2 text-foreground no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
    nowrap && "whitespace-nowrap",
    numeric && "tabular-nums",
    className,
  )}
  {href}
>
  <slot />
</a>
