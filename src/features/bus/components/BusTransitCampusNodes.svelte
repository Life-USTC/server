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
      <circle cx={position.x} cy={position.y} r={NODE_R + 10} fill="var(--background)" stroke="var(--border)" stroke-width="2" />
      <circle cx={position.x} cy={position.y} r={NODE_R} fill="var(--card)" stroke="var(--border)" stroke-width="3" />
      <circle cx={position.x} cy={position.y} r={NODE_R - 8} fill="var(--muted)" stroke="#57606a" stroke-width="2" />
      <text
        x={position.x + label.dx}
        y={position.y + label.dy}
        text-anchor={label.textAnchor}
        class="fill-current font-semibold text-[28px]"
        data-campus-label={campus.namePrimary}
        paint-order="stroke"
        stroke="var(--card)"
        stroke-linejoin="round"
        stroke-width="8"
      >
        {campus.namePrimary}
      </text>
      {#if campus.nameSecondary}
        <text
          x={position.x + label.dx}
          y={position.y + label.dy + 22}
          text-anchor={label.textAnchor}
          class="fill-[#57606a] text-[16px]"
          paint-order="stroke"
          stroke="var(--card)"
          stroke-linejoin="round"
          stroke-width="7"
        >
          {campus.nameSecondary}
        </text>
      {/if}
    </g>
  {/if}
{/each}
