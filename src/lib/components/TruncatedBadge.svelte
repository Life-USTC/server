<script lang="ts">
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge, type BadgeVariant } from "$lib/components/ui/badge/index.js";
import { cn } from "$lib/utils.js";

export let text: string | number;
export let variant: BadgeVariant = "outline";

let className = "";

export { className as class };
</script>

<Badge class={cn("min-w-0 max-w-full shrink", className)} {variant}>
  <TruncatedText class="min-h-0" {text} />
</Badge>
