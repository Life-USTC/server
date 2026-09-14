<script context="module" lang="ts">
export type DailySeriesChartLabels = {
  dataTable?: string;
  day?: string;
  inspect?: string;
  legend?: string;
  noData?: string;
  partial?: string;
  value?: string;
};
</script>

<script lang="ts">
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import {
  buildDailySeriesGeometry,
  dailySeriesX,
  nearestDailySeriesIndex,
  type DailySeries,
} from "./daily-series";

export let days: readonly string[] = [];
export let series: readonly DailySeries[] = [];
export let title = "Daily trends";
export let description = "";
export let locale = "en-US";
export let labels: DailySeriesChartLabels = {};
export let id = "daily-series-chart";
export let partialDays: readonly boolean[] = [];
export let maxVisibleSeries = 6;

const defaultLabels: Required<DailySeriesChartLabels> = {
  dataTable: "View data table",
  day: "Day",
  inspect: "Inspect a day with the arrow keys",
  legend: "Series",
  noData: "No trend data is available for this period.",
  partial: "partial",
  value: "Count",
};
const defaultColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
let width = 640;
let activeIndex: number | null = null;
let visibleKeys = new Set<string>();
let visibleSeriesSignature = "";

$: copy = { ...defaultLabels, ...labels };
$: chartId = id;
$: seriesKeySignature = series.map((item) => item.key).join("\u0000");
$: if (seriesKeySignature !== visibleSeriesSignature) {
  visibleKeys = new Set(
    series.slice(0, Math.max(1, maxVisibleSeries)).map((item) => item.key),
  );
  visibleSeriesSignature = seriesKeySignature;
}
$: visibleSeries = series.filter((item) => visibleKeys.has(item.key));
$: geometry = buildDailySeriesGeometry(days, visibleSeries, { width });
$: hasValues = series.some((item) =>
  item.values.some((value) => value !== null && Number.isFinite(value)),
);
$: numberFormatter = new Intl.NumberFormat(locale);
$: dayFormatter = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Shanghai",
});
$: activeDay = activeIndex === null ? null : days[activeIndex] ?? null;
$: activeDayLabel = activeDay ? formatDay(activeDay, activeIndex ?? 0) : "";

function formatDay(day: string, index: number) {
  const partial = partialDays[index] ? ` (${copy.partial})` : "";
  const parsed = new Date(`${day}T00:00:00+08:00`);
  if (Number.isNaN(parsed.getTime())) return `${day}${partial}`;
  return `${dayFormatter.format(parsed)}${partial}`;
}

function seriesColor(item: DailySeries, index: number) {
  return item.color ?? defaultColors[index % defaultColors.length];
}

function toggleSeries(key: string) {
  const next = new Set(visibleKeys);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  visibleKeys = next;
}

function inspectPointer(event: PointerEvent) {
  if (event.pointerType === "touch" && event.type === "pointermove") return;
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
  if (!bounds.width || !days.length) return;
  const x = ((event.clientX - bounds.left) * geometry.width) / bounds.width;
  activeIndex = nearestDailySeriesIndex(x, days.length, geometry.width);
}

function inspectKeyboard(event: KeyboardEvent) {
  if (!days.length) return;
  const current = activeIndex ?? 0;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    activeIndex = Math.min(days.length - 1, current + 1);
  } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    activeIndex = Math.max(0, current - 1);
  } else if (event.key === "Home") {
    activeIndex = 0;
  } else if (event.key === "End") {
    activeIndex = days.length - 1;
  } else if (event.key === "Escape") {
    activeIndex = null;
  } else {
    return;
  }
  event.preventDefault();
}

function valueAt(item: DailySeries, index: number) {
  const value = item.values[index];
  return value === null || value === undefined ? "—" : numberFormatter.format(value);
}

function activeValueText(index: number) {
  return visibleSeries
    .map((item) => `${item.label}: ${valueAt(item, index)}`)
    .join(", ");
}

function tooltipLeft(index: number) {
  if (!geometry.width) return "0px";
  const x = dailySeriesX(index, days.length, geometry.width);
  return `${Math.max(0, Math.min(geometry.width - 208, x - 104))}px`;
}
</script>

<section class="grid min-w-0 gap-3" aria-labelledby={`${chartId}-title`}>
  <header class="grid gap-1">
    <h3 id={`${chartId}-title`} class="text-base font-semibold">{title}</h3>
    {#if description}<p id={`${chartId}-description`} class="text-sm text-muted-foreground">{description}</p>{/if}
  </header>

  {#if series.length}
    <fieldset class="grid gap-2" aria-label={copy.legend}>
      <legend class="text-xs font-medium text-muted-foreground">{copy.legend}</legend>
      <div class="flex flex-wrap gap-2">
        {#each series as item, index (item.key)}
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-pressed={visibleKeys.has(item.key)}
            aria-label={item.label}
            data-series-key={item.key}
            onclick={() => toggleSeries(item.key)}
          >
            <span
              class:opacity-40={!visibleKeys.has(item.key)}
              class="size-2.5 shrink-0 rounded-full"
              style={`background-color: ${seriesColor(item, index)}`}
              aria-hidden="true"
            ></span>
            <span class:opacity-60={!visibleKeys.has(item.key)}>{item.label}</span>
          </button>
        {/each}
      </div>
    </fieldset>
  {/if}

  {#if !hasValues}
    <Empty.Root class="items-start border-y px-0 text-left">
      <Empty.Header class="items-start text-left">
        <Empty.Title>{copy.noData}</Empty.Title>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <div
      class="relative min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      role="slider"
      tabindex="0"
      aria-label={title}
      aria-describedby={description ? `${chartId}-description` : undefined}
      aria-valuemin="0"
      aria-valuemax={Math.max(0, days.length - 1)}
      aria-valuenow={activeIndex ?? 0}
      aria-valuetext={activeIndex === null || !days.length ? copy.inspect : `${activeDayLabel}: ${activeValueText(activeIndex)}`}
      aria-roledescription="chart"
      data-testid="daily-series-chart"
      onpointermove={inspectPointer}
      onpointerdown={inspectPointer}
      onpointerleave={(event) => { if (event.pointerType === "mouse") activeIndex = null; }}
      onfocus={() => { if (activeIndex === null && days.length) activeIndex = 0; }}
      onblur={() => { activeIndex = null; }}
      onkeydown={inspectKeyboard}
    >
      <span class="sr-only">{copy.inspect}</span>
      <svg
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        class="block h-56 w-full select-none"
        role="img"
        aria-labelledby={`${chartId}-title`}
        aria-describedby={description ? `${chartId}-description` : undefined}
        preserveAspectRatio="none"
      >
        {#each geometry.yTicks as tick (tick.value)}
          <line x1="44" x2={geometry.width - 12} y1={tick.y} y2={tick.y} class="stroke-border" />
          <text x="38" y={tick.y + 4} text-anchor="end" class="fill-muted-foreground text-[11px]">{numberFormatter.format(tick.value)}</text>
        {/each}
        <text x="11" y={(geometry.plotTop + geometry.plotBottom) / 2} text-anchor="middle" transform={`rotate(-90 11 ${(geometry.plotTop + geometry.plotBottom) / 2})`} class="fill-muted-foreground text-[11px]">{copy.value}</text>
        {#each geometry.xLabels as label (label.index)}
          <text x={label.x} y={geometry.height - 7} text-anchor={geometry.xLabels.length === 1 ? "middle" : label.index === 0 ? "start" : label.index === days.length - 1 ? "end" : "middle"} class="fill-muted-foreground text-[11px]">{formatDay(label.day, label.index)}</text>
        {/each}
        {#each geometry.paths as path, index (path.key)}
          <path d={path.path} fill="none" stroke={seriesColor(visibleSeries[index], series.findIndex((item) => item.key === path.key))} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
          {#if path.points.length === 1}
            <circle cx={path.points[0].x} cy={path.points[0].y} r="3" fill={seriesColor(visibleSeries[index], series.findIndex((item) => item.key === path.key))} />
          {/if}
        {/each}
        {#if activeIndex !== null && days[activeIndex]}
          <line x1={dailySeriesX(activeIndex, days.length, geometry.width)} x2={dailySeriesX(activeIndex, days.length, geometry.width)} y1={geometry.plotTop} y2={geometry.plotBottom} class="stroke-foreground/30" stroke-dasharray="3 3" />
        {/if}
      </svg>
      {#if activeIndex !== null && activeDay}
        <div
          class="bg-popover text-popover-foreground pointer-events-none absolute top-1 grid w-52 max-w-[calc(100%-1rem)] gap-1 rounded-md border p-2 text-xs shadow-md"
          style:left={tooltipLeft(activeIndex)}
          role="status"
        >
          <p class="font-medium">{activeDayLabel}</p>
          <p>{activeValueText(activeIndex)}</p>
        </div>
      {/if}
    </div>
  {/if}

  <details class="rounded-md border px-3 py-2 text-sm">
    <summary class="cursor-pointer font-medium">{copy.dataTable}</summary>
    <div class="mt-3 max-h-72 overflow-auto">
      <Table.Root>
        <Table.Caption class="sr-only">{copy.dataTable}</Table.Caption>
        <Table.Header>
          <Table.Row>
            <Table.Head>{copy.day}</Table.Head>
            {#each series as item (item.key)}<Table.Head class="text-right">{item.label}</Table.Head>{/each}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each days as day, index (day)}
            <Table.Row>
              <Table.Cell>{formatDay(day, index)}</Table.Cell>
              {#each series as item (item.key)}<Table.Cell class="text-right tabular-nums">{valueAt(item, index)}</Table.Cell>{/each}
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  </details>
</section>
