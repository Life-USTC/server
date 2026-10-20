<script lang="ts">
import type { Snippet } from "svelte";
import type { EmptyVariant } from "#lib/components/empty-variants.js";
import ResultsEmpty from "#lib/components/ResultsEmpty.svelte";
import SoftEmptyMessage from "#lib/components/SoftEmptyMessage.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { cn } from "#lib/utils.js";

let {
  variant = "browse",
  title = "",
  description = "",
  clearFilterLabel = "",
  onClearFilter,
  class: className = "",
  children,
}: {
  variant?: EmptyVariant;
  title?: string;
  description?: string;
  clearFilterLabel?: string;
  onClearFilter?: (() => void) | undefined;
  class?: string;
  children?: Snippet;
} = $props();
</script>

{#if variant === "quiet"}
  <SoftEmptyMessage class={className} message={description || title} />
{:else}
  <div class={cn(variant === "filter-clear" ? "py-6" : "py-10", className)} data-empty-variant={variant}>
    <ResultsEmpty {description} {title}>
      {#if variant === "filter-clear" && onClearFilter && clearFilterLabel}
        <Button variant="outline" onclick={onClearFilter}>{clearFilterLabel}</Button>
      {/if}
      {@render children?.()}
    </ResultsEmpty>
  </div>
{/if}
