<script lang="ts">
import type { HomeworkDetailMetaRow } from "@/features/homeworks/lib/homework-detail-meta";
import { cn } from "$lib/utils.js";

export let rows: HomeworkDetailMetaRow[];
</script>

<dl class="grid overflow-hidden rounded-lg border sm:grid-cols-3">
  {#each rows as row (row.key)}
    <div
      class={cn(
        "border-b px-3.5 py-3 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0",
        row.emphasis && "bg-muted/50",
      )}
    >
      <dt class="text-muted-foreground text-xs">{row.label}</dt>
      <dd class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span class={cn("text-sm tabular-nums", row.emphasis ? "font-semibold" : "font-medium")}>
          {row.value}
        </span>
        {#if row.hint}
          <span class="text-muted-foreground text-xs">{row.hint}</span>
        {/if}
      </dd>
    </div>
  {/each}
</dl>
