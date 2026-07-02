<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import { cn } from "$lib/utils.js";

type DetailPinnedSummaryItem = {
  label: string;
  mono?: boolean;
  variant?: "ghost" | "outline" | "secondary";
};

export let activeSectionLabel = "";
export let className = "";
export let description = "";
export let eyebrow = "";
export let items: DetailPinnedSummaryItem[] = [];
export let title: string;
</script>

<div
  class={cn(
    "sticky top-12 -mx-4 border-base-300 border-y bg-base-100/95 px-4 py-2 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6",
    className,
  )}
  data-testid="detail-pinned-summary"
>
  <div class="flex min-h-12 items-center justify-between gap-3">
    <div class="min-w-0">
      <div class="mb-0.5 flex min-w-0 items-center gap-2">
        {#if eyebrow}
          <p class="shrink-0 font-medium text-[0.68rem] text-base-content/50 uppercase tracking-normal">
            {eyebrow}
          </p>
        {/if}
        {#if activeSectionLabel}
          <span class="truncate rounded-sm bg-base-200 px-1.5 py-0.5 font-medium text-base-content/70 text-xs">
            {activeSectionLabel}
          </span>
        {/if}
      </div>
      <p class="truncate font-semibold text-sm">{title}</p>
      {#if description}
        <p class="truncate text-base-content/60 text-xs">{description}</p>
      {/if}
    </div>

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
</div>
