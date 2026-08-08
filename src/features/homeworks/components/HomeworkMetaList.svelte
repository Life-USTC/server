<script lang="ts">
import type { HomeworkDetailMetaRow } from "@/features/homeworks/lib/homework-detail-meta";

export let rows: HomeworkDetailMetaRow[];
</script>

<dl class="divide-y rounded-lg border">
  {#each rows as row (row.key)}
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3.5 py-2.5">
      <dt class="text-muted-foreground text-xs">{row.label}</dt>
      <dd class="text-sm tabular-nums">{row.value}</dd>
    </div>
  {/each}
</dl>
