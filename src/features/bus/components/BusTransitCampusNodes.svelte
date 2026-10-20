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

<style>
  /* Desktop: half the historical 28px/16px labels. Mobile keeps full size so
     #372 `labelHeights >= 10` still holds after viewBox compression. */
  .campus-label-primary {
    font-size: 14px;
    stroke-width: 4;
  }
  .campus-label-secondary {
    font-size: 8px;
    stroke-width: 3.5;
  }
  @media (max-width: 767px) {
    .campus-label-primary {
      font-size: 28px;
      stroke-width: 8;
    }
    .campus-label-secondary {
      font-size: 16px;
      stroke-width: 7;
      transform: translateY(11px);
    }
  }
</style>

{#each campuses as campus}
  {@const position = positions.get(campus.id)}
  {#if position}
    {@const label = labelOffset(position, campus.namePrimary)}
    <g>
      <circle cx={position.x} cy={position.y} r={NODE_R + 5} fill="var(--background)" stroke="var(--border)" stroke-width="1.5" />
      <circle cx={position.x} cy={position.y} r={NODE_R} fill="var(--card)" stroke="var(--border)" stroke-width="2" />
      <circle cx={position.x} cy={position.y} r={NODE_R - 4} fill="var(--muted)" stroke="var(--muted-foreground)" stroke-width="1.5" />
      <text
        x={position.x + label.dx}
        y={position.y + label.dy}
        text-anchor={label.textAnchor}
        class="campus-label-primary fill-current font-semibold"
        data-campus-label={campus.namePrimary}
        paint-order="stroke"
        stroke="var(--card)"
        stroke-linejoin="round"
      >
        {campus.namePrimary}
      </text>
      {#if campus.nameSecondary}
        <text
          x={position.x + label.dx}
          y={position.y + label.dy + 11}
          text-anchor={label.textAnchor}
          class="campus-label-secondary fill-muted-foreground"
          paint-order="stroke"
          stroke="var(--card)"
          stroke-linejoin="round"
        >
          {campus.nameSecondary}
        </text>
      {/if}
    </g>
  {/if}
{/each}
