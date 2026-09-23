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
let activeCellIndex = 0;
let cellElements: HTMLButtonElement[] = [];

$: heatmapGridTemplate = `repeat(${weeks.length}, var(--heatmap-column-size))`;
$: weekdayRows = Array.from({ length: 7 }, (_, weekday) =>
  weeks.map((week) => week[weekday]).filter(Boolean),
);
$: if (activeCellIndex >= weeks.length * 7) activeCellIndex = 0;

function contributionLabel(day: ContributionCell) {
  return cellLabel
    .replace("{count}", String(day.count))
    .replace("{date}", dateFormatter.format(new Date(day.date)));
}

function focusCell(index: number) {
  if (index < 0 || index >= weeks.length * 7) return;
  activeCellIndex = index;
  cellElements[index]?.focus();
}

function handleCellKeydown(event: KeyboardEvent, index: number) {
  const columnCount = weeks.length;
  const columnIndex = index % columnCount;
  let nextIndex: number | null = null;

  switch (event.key) {
    case "ArrowLeft":
      if (columnIndex > 0) nextIndex = index - 1;
      break;
    case "ArrowRight":
      if (columnIndex < columnCount - 1) nextIndex = index + 1;
      break;
    case "ArrowUp":
      if (index >= columnCount) nextIndex = index - columnCount;
      break;
    case "ArrowDown":
      if (index < columnCount * 6) nextIndex = index + columnCount;
      break;
    case "Home":
      nextIndex = event.ctrlKey ? 0 : index - columnIndex;
      break;
    case "End":
      nextIndex = event.ctrlKey
        ? columnCount * 7 - 1
        : index + columnCount - columnIndex - 1;
      break;
    default:
      return;
  }

  if (nextIndex === null) return;
  event.preventDefault();
  focusCell(nextIndex);
}
</script>

<div
  class="profile-heatmap min-w-0 overflow-x-auto overscroll-x-contain pb-2"
  data-profile-heatmap-scroll
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
      aria-colcount={weeks.length}
      aria-label={scrollLabel}
      aria-rowcount={weekdayRows.length}
      class="grid gap-px"
      data-profile-contribution-grid
      role="grid"
      style={`grid-template-columns: ${heatmapGridTemplate};`}
    >
      {#each weekdayRows as row, rowIndex}
        <div class="contents" role="row">
          {#each row as day, columnIndex}
            {@const label = contributionLabel(day)}
            {@const cellIndex = rowIndex * weeks.length + columnIndex}
            <button
              aria-colindex={columnIndex + 1}
              aria-label={label}
              aria-rowindex={rowIndex + 1}
              aria-selected={selectedCellLabel === label}
              bind:this={cellElements[cellIndex]}
              class="flex size-6 items-center justify-center rounded-sm p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:size-4"
              data-count={day.count}
              data-date={day.date}
              data-profile-contribution-cell
              role="gridcell"
              tabindex={activeCellIndex === cellIndex ? 0 : -1}
              onclick={() => {
                activeCellIndex = cellIndex;
                selectedCellLabel = label;
              }}
              onfocus={() => {
                activeCellIndex = cellIndex;
                selectedCellLabel = label;
              }}
              onkeydown={(event) => handleCellKeydown(event, cellIndex)}
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
