<script lang="ts">
import type { Snippet } from "svelte";
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
  status,
  statusVisible = false,
  title,
}: Props = $props();
</script>

<div
  class={cn(
    "sticky top-12 z-20 -mx-4 -mt-4 border-base-300 border-b bg-base-100 px-4 py-2.5 sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6",
    className,
  )}
  data-testid="detail-pinned-summary"
>
  <div class="flex min-h-12 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div class="min-w-0 flex-1">
      {#if activeSectionLabel || eyebrow}
        <p class="truncate font-medium text-[0.68rem] text-base-content/50 uppercase tracking-normal">
          {activeSectionLabel || eyebrow}
        </p>
      {/if}
      <h1 class="truncate font-semibold text-base leading-6">{title}</h1>
      {#if description || items.length}
        <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-base-content/60 text-xs">
          {#if description}
            <span class="max-w-full truncate">{description}</span>
          {/if}
          {#each items as item}
            <span class={cn("max-w-52 truncate", item.mono ? "font-mono" : "")}>
              {item.label}
            </span>
          {/each}
        </div>
      {/if}
    </div>

    {#if actions}
      <div class="flex shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
        {@render actions()}
      </div>
    {/if}
  </div>

  {#if status && statusVisible}
    <div class="pt-2">
      {@render status()}
    </div>
  {/if}
</div>
