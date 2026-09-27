<script lang="ts">
import { cn } from "$lib/utils.js";
import TruncatedText from "./TruncatedText.svelte";

export let text: string | number | null | undefined;

let className = "";

export { className as class };

$: displayText = text == null ? "" : String(text);
</script>

<span
  class={cn(
    "block min-w-0 max-w-full font-mono text-sm tabular-nums",
    className,
  )}
  data-slot="catalog-code"
>
  <TruncatedText text={displayText} />
</span>
