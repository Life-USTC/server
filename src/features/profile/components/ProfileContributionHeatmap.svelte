<script lang="ts">
import type { ContributionCell } from "./profile-contribution-types";

export let cellLabel: string;
export let dateFormatter: Intl.DateTimeFormat;
export let heatmapClass: (count: number) => string;
export let monthLabels: string[];
export let weeks: ContributionCell[][];

$: heatmapGridTemplate = `repeat(${weeks.length}, minmax(0, 1fr))`;
</script>

<div class="min-w-0 overflow-hidden pb-2">
  <div class="grid min-w-0 gap-y-1">
    <div
      class="grid min-w-0 gap-px overflow-visible text-base-content/50 text-[0.65rem]"
      style={`grid-template-columns: ${heatmapGridTemplate};`}
    >
      {#each monthLabels as label}
        <span class="h-4 overflow-visible whitespace-nowrap">{label}</span>
      {/each}
    </div>

    <div
      class="grid min-w-0 gap-px"
      style={`grid-template-columns: ${heatmapGridTemplate};`}
    >
      {#each weeks as week}
        <div class="grid min-w-0 grid-rows-7 gap-px">
          {#each week as day}
            <div
              class={`aspect-square w-full max-w-3 rounded-[2px] ${heatmapClass(day.count)}`}
              title={cellLabel
                .replace("{count}", String(day.count))
                .replace("{date}", dateFormatter.format(new Date(day.date)))}
            ></div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>
