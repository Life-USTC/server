<script lang="ts" module>
function formatTemperature(value: number) {
  return `${Math.round(value)}°`;
}
</script>

<script lang="ts">
import type { WeatherHourly } from "@/features/weather/server/weather-types";
import { buildHourlyChartGeometry } from "@/features/weather/weather-ui";
import { formatShanghaiTime } from "$lib/time/shanghai-format";

type Props = {
  hours: WeatherHourly[];
  chartAriaLabel: string;
};

let { hours, chartAriaLabel }: Props = $props();

const WIDTH = 640;

const geometry = $derived(buildHourlyChartGeometry(hours, { width: WIDTH }));

let hoverIndex = $state<number | null>(null);

function handleMove(event: MouseEvent) {
  const svg = event.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  if (rect.width === 0 || geometry.points.length === 0) return;
  const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
  let best = 0;
  let bestDistance = Infinity;
  geometry.points.forEach((point, i) => {
    const distance = Math.abs(point.x - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  hoverIndex = best;
}

const hoverHour = $derived(hoverIndex === null ? null : hours[hoverIndex]);
const hoverPoint = $derived(
  hoverIndex === null ? null : geometry.points[hoverIndex],
);
</script>

<div class="relative" data-testid="weather-hourly-chart">
  <svg
    viewBox="0 0 {WIDTH} {geometry.height}"
    class="h-auto w-full touch-none select-none"
    role="img"
    aria-label={chartAriaLabel}
    onmousemove={handleMove}
    onmouseleave={() => (hoverIndex = null)}
  >
    <line
      x1="0"
      x2={WIDTH}
      y1={geometry.tempBaselineY}
      y2={geometry.tempBaselineY}
      class="stroke-border"
      stroke-dasharray="3 4"
    />
    {#if geometry.areaPath}
      <path d={geometry.areaPath} class="fill-amber-500/10" />
      <path
        d={geometry.tempPath}
        fill="none"
        class="stroke-amber-500"
        stroke-width="2"
        stroke-linecap="round"
      />
    {/if}
    {#each geometry.bars as bar, i (hours[i].at)}
      <rect
        x={bar.x}
        y={bar.y}
        width={bar.width}
        height={bar.height}
        rx="2"
        class={bar.probability > 0 ? "fill-sky-500/70" : "fill-transparent"}
      />
    {/each}
    {#each geometry.xLabels as label (label.label + label.x)}
      <text
        x={label.x}
        y={geometry.height - 6}
        text-anchor="middle"
        class="fill-muted-foreground text-[11px]"
      >
        {label.label}
      </text>
    {/each}
    {#if hoverPoint && hoverIndex !== null}
      <line
        x1={hoverPoint.x}
        x2={hoverPoint.x}
        y1="4"
        y2={geometry.height - 22}
        class="stroke-foreground/30"
      />
      <circle cx={hoverPoint.x} cy={hoverPoint.y} r="4" class="fill-amber-500" />
    {/if}
  </svg>

  {#if hoverHour && hoverPoint}
    <div
      class="bg-popover text-popover-foreground pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border px-2 py-1 text-xs shadow-md"
      style:left="{(hoverPoint.x / WIDTH) * 100}%"
    >
      <p class="font-medium whitespace-nowrap">
        {formatShanghaiTime(hoverHour.at)}
        {formatTemperature(hoverHour.temperature)}
        {#if hoverHour.condition}
          <span class="text-muted-foreground">{hoverHour.condition.text}</span>
        {/if}
      </p>
      {#if hoverHour.precipitationProbability !== undefined}
        <p class="text-sky-600 whitespace-nowrap dark:text-sky-400">
          {hoverHour.precipitationProbability}%
          {#if hoverHour.precipitationAmount !== undefined && hoverHour.precipitationAmount > 0}
            · {hoverHour.precipitationAmount}mm
          {/if}
        </p>
      {/if}
    </div>
  {/if}
</div>
