<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import type { EmptyVariant } from "#lib/components/empty-variants.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Empty from "#lib/components/ui/empty/index.js";
import { cn } from "#lib/utils.js";

let {
  variant = "browse",
  title = "",
  description = "",
  clearFilterLabel = "",
  onClearFilter,
  clearHref,
  class: className,
  media,
  children,
  ...restProps
}: Omit<HTMLAttributes<HTMLDivElement>, "children" | "class"> & {
  class?: string;
  variant?: EmptyVariant;
  title?: string;
  description?: string;
  clearFilterLabel?: string;
  clearHref?: string;
  onClearFilter?: () => void;
  media?: Snippet;
  children?: Snippet;
} = $props();
</script>

{#if variant === "quiet"}
  <p class={cn("text-sm text-muted-foreground", className)} data-empty-variant="quiet" {...restProps}>{description || title}</p>
{:else}
  <Empty.Root
    class={cn(
      "bg-muted/30",
      variant === "compact" ? "min-h-20 py-6" : variant === "filter-clear" ? "py-6" : "py-10",
      className,
    )}
    data-empty-variant={variant}
    {...restProps}
  >
    <Empty.Header>
      {#if media}<Empty.Media variant="icon">{@render media()}</Empty.Media>{/if}
      {#if title}<Empty.Title>{title}</Empty.Title>{/if}
      {#if description}<Empty.Description>{description}</Empty.Description>{/if}
    </Empty.Header>
    {#if children || (variant === "filter-clear" && (onClearFilter || clearHref) && clearFilterLabel)}
      <Empty.Content>
        {#if variant === "filter-clear" && (onClearFilter || clearHref) && clearFilterLabel}
          <Button href={clearHref} variant="outline" onclick={onClearFilter}>{clearFilterLabel}</Button>
        {/if}
        {@render children?.()}
      </Empty.Content>
    {/if}
  </Empty.Root>
{/if}
