<script lang="ts">
import { cn } from "$lib/utils.js";

export let href: string;
export let nowrap = false;
export let numeric = false;
export let mono = false;

let className = "";

export { className as class };
</script>

<a
  class={cn(
    "flex h-full min-h-12 min-w-0 w-full items-center overflow-hidden px-3 text-foreground no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
    nowrap && "whitespace-nowrap",
    numeric && "tabular-nums",
    mono && "font-mono",
    className,
  )}
  {href}
>
  <slot />
</a>
