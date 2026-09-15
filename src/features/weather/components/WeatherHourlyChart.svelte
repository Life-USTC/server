<script lang="ts">
import type { WeatherHourly } from "@/features/weather/server/weather-types";
import { buildHourlyChartGeometry } from "@/features/weather/weather-ui";
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { formatShanghaiTime } from "$lib/time/shanghai-format";
import WeatherConditionIcon from "./WeatherConditionIcon.svelte";

let {
  hours,
  weatherCopy,
}: { hours: WeatherHourly[]; weatherCopy: AppPageCopy["weather"] } = $props();
const hintId = $props.id();
let width = $state(640);
let tooltipWidth = $state(144);
let activeIndex = $state<number | null>(null);
const geometry = $derived(buildHourlyChartGeometry(hours, { width }));
const activeHour = $derived(activeIndex === null ? null : hours[activeIndex]);
const activePoint = $derived(
  activeIndex === null ? null : geometry.points[activeIndex],
);
const tooltipLeft = $derived(
  Math.max(
    0,
    Math.min(width - tooltipWidth, (activePoint?.x ?? 0) - tooltipWidth / 2),
  ),
);

function hourLabel(hour: WeatherHourly) {
  const rain =
    hour.precipitationProbability === undefined
      ? ""
      : weatherCopy.precipitationProbability.replace(
          "{value}",
          String(hour.precipitationProbability),
        );
  return `${formatShanghaiTime(hour.at)} · ${Math.round(hour.temperature)}°C · ${hour.condition?.text ?? ""} ${rain}`;
}
function inspectPointer(event: PointerEvent) {
  if (event.pointerType === "touch" && event.type === "pointermove") return;
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
  if (!bounds.width || !hours.length) return;
  const x = ((event.clientX - bounds.left) * width) / bounds.width;
  let nearest = 0;
  geometry.points.forEach((point, index) => {
    if (Math.abs(point.x - x) < Math.abs(geometry.points[nearest].x - x))
      nearest = index;
  });
  activeIndex = nearest;
}
function inspectKeyboard(event: KeyboardEvent) {
  const current = activeIndex ?? 0;
  if (event.key === "ArrowRight" || event.key === "ArrowUp")
    activeIndex = Math.min(hours.length - 1, current + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown")
    activeIndex = Math.max(0, current - 1);
  else if (event.key === "Home") activeIndex = 0;
  else if (event.key === "End") activeIndex = hours.length - 1;
  else if (event.key === "Escape") activeIndex = null;
  else return;
  event.preventDefault();
}
</script>

<div class="grid min-w-0 gap-2" data-testid="weather-hourly-chart">
  <span class="sr-only" id={hintId}>{weatherCopy.hourlyChartHint}</span>
  <div class="text-muted-foreground flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs" aria-hidden="true">
    <span class="flex items-center gap-1.5"><span class="h-0.5 w-3 bg-amber-500"></span>{weatherCopy.temperatureLegend}</span>
    <span class="flex items-center gap-1.5"><span class="h-2 w-2 bg-sky-500/70"></span>{weatherCopy.precipitationLegend}</span>
  </div>
  <div
    class="relative min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    bind:clientWidth={width}
    role="slider"
    tabindex="0"
    aria-label={weatherCopy.hourlyForecast}
    aria-describedby={hintId}
    aria-valuemin="0"
    aria-valuemax={Math.max(0, hours.length - 1)}
    aria-valuenow={activeIndex ?? 0}
    aria-valuetext={hours.length ? hourLabel(activeHour ?? hours[0]) : undefined}
    onpointermove={inspectPointer}
    onpointerdown={inspectPointer}
    onpointerleave={(event) => { if (event.pointerType === "mouse") activeIndex = null; }}
    onfocus={() => { activeIndex ??= 0; }}
    onblur={() => { activeIndex = null; }}
    onkeydown={inspectKeyboard}
  >
    <svg viewBox="0 0 {width} {geometry.height}" class="block w-full select-none" aria-hidden="true">
      <line x1="0" x2={width} y1={geometry.tempBaselineY} y2={geometry.tempBaselineY} class="stroke-border" stroke-dasharray="3 4" />
      {#if geometry.areaPath}<path d={geometry.areaPath} class="fill-amber-500/10" />{/if}
      {#each geometry.bars as bar, i (hours[i].at)}
        <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx="2" class={bar.probability > 0 ? "fill-sky-500/60" : "fill-transparent"} />
      {/each}
      {#if geometry.tempPath}<path d={geometry.tempPath} fill="none" class="stroke-amber-500" stroke-width="2" vector-effect="non-scaling-stroke" />{/if}
      {#if geometry.points.length === 1}
        <circle cx={geometry.points[0].x} cy={geometry.points[0].y} r="3" class="fill-amber-500" />
      {/if}
      {#each geometry.xLabels as label, i (label.label + label.x)}
        <text x={label.x} y={geometry.height - 6} text-anchor={geometry.xLabels.length === 1 ? "middle" : i === 0 ? "start" : i === geometry.xLabels.length - 1 ? "end" : "middle"} class="fill-muted-foreground text-[11px]">{label.label}</text>
      {/each}
      {#if activePoint}
        <line x1={activePoint.x} x2={activePoint.x} y1="4" y2={geometry.tempBaselineY} class="stroke-foreground/30" />
        <circle cx={activePoint.x} cy={activePoint.y} r="3" class="fill-amber-500" />
      {/if}
    </svg>
    {#if activeHour && activePoint}
      <div
        role="tooltip"
        bind:offsetWidth={tooltipWidth}
        class="bg-popover text-popover-foreground pointer-events-none absolute top-0 grid w-36 max-w-full gap-1 rounded-md border p-2 text-xs shadow-md"
        style:left="{tooltipLeft}px"
      >
        <p class="font-medium">{formatShanghaiTime(activeHour.at)}</p>
        {#if activeHour.condition}
          <p class="flex items-center gap-1.5"><WeatherConditionIcon condition={activeHour.condition} class="size-5 shrink-0" />{activeHour.condition.text}</p>
        {/if}
        <p class="font-medium">{Math.round(activeHour.temperature)}°C</p>
        {#if activeHour.precipitationProbability !== undefined}
          <p class="text-sky-700 dark:text-sky-400">{weatherCopy.precipitationProbability.replace("{value}", String(activeHour.precipitationProbability))}</p>
        {/if}
        {#if activeHour.precipitationAmount !== undefined && activeHour.precipitationAmount > 0}<p>{activeHour.precipitationAmount} mm</p>{/if}
      </div>
    {/if}
  </div>
</div>
