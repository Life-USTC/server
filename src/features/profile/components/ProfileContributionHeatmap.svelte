<script lang="ts">
import { cn } from "$lib/utils.js";
import type { ContributionCell } from "./profile-contribution-types";

export let cellLabel: string;
export let dateFormatter: Intl.DateTimeFormat;
export let heatmapClass: (count: number) => string;
export let monthLabels: string[];
export let scrollLabel: string;
export let weeks: ContributionCell[][];

let selectedCellLabel = "";

$: heatmapGridTemplate = `repeat(${weeks.length}, var(--heatmap-column-size))`;

function contributionLabel(day: ContributionCell) {
  return cellLabel
    .replace("{count}", String(day.count))
    .replace("{date}", dateFormatter.format(new Date(day.date)));
}
</script>

<div
  aria-label={scrollLabel}
  class="profile-heatmap min-w-0 overflow-x-auto overscroll-x-contain pb-2"
  data-profile-heatmap-scroll
  role="region"
>
  <div class="grid w-max gap-y-1">
    <div
      class="grid gap-px overflow-visible text-muted-foreground text-[0.65rem]"
      style={`grid-template-columns: ${heatmapGridTemplate};`}
    >
      {#each monthLabels as label}
        <span class="h-4 overflow-visible whitespace-nowrap">{label}</span>
      {/each}
    </div>

    <div
      class="grid gap-px"
      style={`grid-template-columns: ${heatmapGridTemplate};`}
    >
      {#each weeks as week}
        <div class="grid grid-rows-7">
          {#each week as day}
            {@const label = contributionLabel(day)}
            <button
              aria-label={label}
              aria-pressed={selectedCellLabel === label}
              class="flex size-6 items-center justify-center rounded-sm p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:size-4"
              data-count={day.count}
              data-date={day.date}
              data-profile-contribution-cell
              onclick={() => {
                selectedCellLabel = label;
              }}
              onfocus={() => {
                selectedCellLabel = label;
              }}
              title={label}
              type="button"
            >
              <span
                aria-hidden="true"
                class={cn(
                  "size-4 rounded-[2px] sm:size-3",
                  heatmapClass(day.count),
                )}
              ></span>
            </button>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>

{#if selectedCellLabel}
  <p
    aria-live="polite"
    class="mt-2 text-muted-foreground text-sm"
    data-profile-contribution-detail
  >
    {selectedCellLabel}
  </p>
{/if}

<style>
  .profile-heatmap {
    --heatmap-column-size: 1.5rem;
  }

  @media (min-width: 640px) {
    .profile-heatmap {
      --heatmap-column-size: 1rem;
    }
  }
</style>
