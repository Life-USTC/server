<script lang="ts">
import { cn } from "$lib/utils.js";
import DashboardPanel from "./DashboardPanel.svelte";

let {
  items,
  class: className,
}: {
  items: { label: string; value: string; hint?: string }[];
  class?: string;
} = $props();
</script>
<div class={cn("grid min-w-0 grid-flow-col auto-cols-[minmax(8.5rem,1fr)] gap-3 overflow-x-auto p-px lg:grid-flow-row lg:grid-cols-[repeat(var(--stat-columns),minmax(0,1fr))] lg:overflow-visible", className)} style:--stat-columns={Math.max(1, Math.min(items.length, 5))}>
  {#each items as item (item.label)}
    <DashboardPanel title={item.label} description={item.hint}>
      <p class="text-2xl font-semibold tracking-tight tabular-nums">{item.value}</p>
    </DashboardPanel>
  {/each}
</div>
