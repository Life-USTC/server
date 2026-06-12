<script lang="ts">
import {
  labelOffset,
  NODE_R,
} from "@/features/bus/components/bus-transit-map-layout";
import type {
  BusMapCampusNode,
  BusMapPoint,
} from "@/features/bus/lib/bus-map-types";

export let campuses: BusMapCampusNode[];
export let positions: Map<number, BusMapPoint>;
</script>

{#each campuses as campus}
  {@const position = positions.get(campus.id)}
  {#if position}
    {@const label = labelOffset(position, campus.namePrimary)}
    <g>
      <circle cx={position.x} cy={position.y} r={NODE_R + 8} fill="#f6f8fa" stroke="#d0d7de" stroke-width="1.5" />
      <circle cx={position.x} cy={position.y} r={NODE_R} fill="white" stroke="#d0d7de" stroke-width="2.5" />
      <circle cx={position.x} cy={position.y} r={NODE_R - 6} fill="#f6f8fa" stroke="#57606a" stroke-width="1.5" />
      <text x={position.x + label.dx} y={position.y + label.dy} text-anchor={label.textAnchor} class="fill-current font-semibold text-[12px]">
        {campus.namePrimary}
      </text>
      {#if campus.nameSecondary}
        <text x={position.x + label.dx} y={position.y + label.dy + 15} text-anchor={label.textAnchor} class="fill-[#57606a] text-[10px]">
          {campus.nameSecondary}
        </text>
      {/if}
    </g>
  {/if}
{/each}
