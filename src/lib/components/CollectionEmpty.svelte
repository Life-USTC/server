<script lang="ts">
import type { Snippet } from "svelte";
import CompactEmpty from "#lib/components/CompactEmpty.svelte";
import type { EmptyVariant } from "#lib/components/empty-variants.js";
import ResultsEmpty from "#lib/components/ResultsEmpty.svelte";
import SoftEmptyMessage from "#lib/components/SoftEmptyMessage.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { ACTION_BUTTON_VARIANT } from "#lib/ui/action-status-tokens.js";
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
{:else if variant === "filter-clear"}
  <div class={cn("py-6", className)} data-empty-variant="filter-clear">
    <ResultsEmpty description={description} title={title || description}>
      {#if onClearFilter && clearFilterLabel}
        <Button
          variant={ACTION_BUTTON_VARIANT.secondary}
          onclick={onClearFilter}
        >
          {clearFilterLabel}
        </Button>
      {/if}
      {@render children?.()}
    </ResultsEmpty>
  </div>
{:else if variant === "setup"}
  <div class={cn("py-10", className)} data-empty-variant="setup">
    <ResultsEmpty description={description} title={title}>
      {@render children?.()}
    </ResultsEmpty>
  </div>
{:else}
  <div class={cn("py-10", className)} data-empty-variant="browse">
    {#if title}
      <ResultsEmpty description={description} {title}>
        {@render children?.()}
      </ResultsEmpty>
    {:else}
      <CompactEmpty {description} />
      {@render children?.()}
    {/if}
  </div>
{/if}
