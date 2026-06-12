<script lang="ts">
import { BUS_H, BUS_W } from "@/features/bus/components/bus-transit-map-layout";

export let angle: number;
export let animate = false;
export let color: string;
export let opacity = 1;
export let onHover: (() => void) | null = null;
export let x: number;
export let y: number;
</script>

<g
  transform={`translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${angle.toFixed(1)})`}
  role="presentation"
  onmouseenter={() => {
    onHover?.();
  }}
>
  <rect x={-BUS_W / 2} y={-BUS_H / 2} width={BUS_W} height={BUS_H} rx="2.5" fill={color} {opacity} />
  <rect x={BUS_W / 2 - 5.5} y={-BUS_H / 2 + 2} width="4" height={BUS_H - 4} rx="1" fill="white" opacity="0.85" />
  <circle cx={BUS_W / 2 - 1} cy={-BUS_H / 2 + 2} r="1" fill="white" opacity="0.6" />
  <circle cx={BUS_W / 2 - 1} cy={BUS_H / 2 - 2} r="1" fill="white" opacity="0.6" />
  {#if animate}
    <animateTransform attributeName="transform" type="translate" values="0,0; 0,-1.5; 0,0" dur="2s" repeatCount="indefinite" additive="sum" />
  {/if}
</g>
