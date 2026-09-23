<script lang="ts">
import { cn } from "$lib/utils.js";

let className = "";

export { className as class };
</script>

<div
  class={cn(
    "flex justify-start gap-1 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100",
    className,
  )}
>
  <slot />
</div>
