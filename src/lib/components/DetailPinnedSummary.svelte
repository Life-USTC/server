<script lang="ts">
import type { Snippet } from "svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { cn } from "$lib/utils.js";

type DetailPinnedSummaryItem = {
  label: string;
  mono?: boolean;
  variant?: "ghost" | "outline" | "secondary";
};

type Props = {
  actions?: Snippet;
  activeSectionLabel?: string;
  className?: string;
  description?: string;
  eyebrow?: string;
  items?: DetailPinnedSummaryItem[];
  parentHref?: string;
  parentLabel?: string;
  status?: Snippet;
  statusVisible?: boolean;
  title: string;
};

let {
  actions,
  activeSectionLabel = "",
  className = "",
  description = "",
  eyebrow = "",
  items = [],
  parentHref = "",
  parentLabel = "",
  status,
  statusVisible = false,
  title,
}: Props = $props();
</script>

<div
  class={cn(
    "sticky top-12 -mx-4 border-base-300 border-b bg-base-100/95 px-4 py-2 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6",
    className,
  )}
  data-testid="detail-pinned-summary"
>
  <div class="flex min-h-12 items-start justify-between gap-3">
    <div class="min-w-0 flex-1">
      <div class="mb-0.5 flex min-w-0 items-center gap-2">
        {#if parentHref && parentLabel}
          <a
            class="shrink-0 font-medium text-[0.68rem] text-base-content/50 uppercase tracking-normal transition-colors hover:text-base-content"
            href={parentHref}
          >
            {parentLabel}
          </a>
          <span class="text-base-content/30 text-xs">/</span>
        {:else if eyebrow}
          <span class="shrink-0 font-medium text-[0.68rem] text-base-content/50 uppercase tracking-normal">
            {eyebrow}
          </span>
        {/if}
        {#if activeSectionLabel}
          <span class="truncate font-medium text-[0.68rem] text-base-content/60 uppercase tracking-normal">
            {activeSectionLabel}
          </span>
        {/if}
      </div>
      <h1 class="truncate font-semibold text-sm">{title}</h1>
      {#if description}
        <p class="truncate text-base-content/60 text-xs">{description}</p>
      {/if}
    </div>

    {#if actions}
      <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {@render actions()}
      </div>
    {/if}

    {#if items.length}
      <div class="hidden max-w-[50%] shrink-0 flex-wrap justify-end gap-1.5 md:flex">
        {#each items as item}
          <Badge
            class={cn("max-w-44 truncate", item.mono ? "font-mono" : "")}
            variant={item.variant ?? "ghost"}
          >
            {item.label}
          </Badge>
        {/each}
      </div>
    {/if}
  </div>

  {#if status && statusVisible}
    <div class="pt-2">
      {@render status()}
    </div>
  {/if}
</div>
