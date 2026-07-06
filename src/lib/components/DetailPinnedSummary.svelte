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
  className?: string;
  description?: string;
  items?: DetailPinnedSummaryItem[];
  status?: Snippet;
  statusVisible?: boolean;
  title: string;
};

let {
  actions,
  className = "",
  description = "",
  items = [],
  status,
  statusVisible = false,
  title,
}: Props = $props();
</script>

<div
  class={cn(
    "bg-card px-4 py-3 sm:px-5 lg:px-6",
    className,
  )}
  data-testid="detail-pinned-summary"
>
  <div class="flex min-h-12 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div class="min-w-0 flex-1">
      <h1 class="truncate font-semibold text-lg leading-6">{title}</h1>
      {#if description || items.length}
        <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
          {#if description}
            <span class="max-w-full truncate">{description}</span>
          {/if}
          {#each items as item}
            <Badge
              class={cn("max-w-52 truncate", item.mono ? "font-mono" : "")}
              variant={item.variant ?? "ghost"}
            >
              {item.label}
            </Badge>
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
