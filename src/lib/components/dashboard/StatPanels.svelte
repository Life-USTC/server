<script lang="ts">
import { cn } from "$lib/utils.js";
import DashboardPanel from "./DashboardPanel.svelte";

let {
  items,
  label,
  class: className,
}: {
  label: string;
  items: { label: string; value: string; hint?: string }[];
  class?: string;
} = $props();
</script>
<!-- Keyboard focus is required to scroll this overflow region without a pointer. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div role="region" aria-label={label} tabindex="0" class={cn("rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring grid min-w-0 grid-flow-col auto-cols-[minmax(8.5rem,1fr)] gap-3 overflow-x-auto p-px lg:grid-flow-row lg:grid-cols-[repeat(var(--stat-columns),minmax(0,1fr))] lg:overflow-visible", className)} style:--stat-columns={Math.max(1, Math.min(items.length, 5))}>
  {#each items as item (item.label)}
    <DashboardPanel title={item.label} description={item.hint}>
      <p class="text-2xl font-semibold tracking-tight tabular-nums">{item.value}</p>
    </DashboardPanel>
  {/each}
</div>
