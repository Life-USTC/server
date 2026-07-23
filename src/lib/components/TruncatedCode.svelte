<script lang="ts">
import { cn } from "$lib/utils.js";

export let text: string | number | null | undefined;

let className = "";

export { className as class };

$: displayText = text == null ? "" : String(text);
</script>

<span
  aria-label={displayText || undefined}
  class={cn(
    "block min-w-0 max-w-full truncate font-mono text-sm tabular-nums",
    className,
  )}
  data-slot="catalog-code"
  title={displayText || undefined}
>
  {displayText}
</span>
