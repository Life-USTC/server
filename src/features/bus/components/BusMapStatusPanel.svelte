<script lang="ts">
import type { BusMapCopy, BusMapData } from "@/features/bus/lib/bus-map-types";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import BusMapActiveTripList from "./BusMapActiveTripList.svelte";

export let allRouteIds: number[];
export let copy: BusMapCopy;
export let dayTypeLabel: string;
export let departingSoonCount: number;
export let enRouteCount: number;
export let hoveredRoute: number | null;
export let mapData: BusMapData;
export let nowMinutes: number;
export let updatedTime: string;
</script>

<Card.Root>
  <Card.Content class="grid gap-4 pt-5">
    <div class="flex items-center justify-between gap-3">
      <Card.Title class="text-base">{copy.statusTitle}</Card.Title>
      <Badge variant="ghost">{dayTypeLabel}</Badge>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <div class="rounded-lg border border-base-300 p-3">
        <p class="text-base-content/60 text-xs">{copy.legend.enRoute}</p>
        <p class="font-semibold text-xl">{enRouteCount}</p>
      </div>
      <div class="rounded-lg border border-base-300 p-3">
        <p class="text-base-content/60 text-xs">{copy.legend.departingSoon}</p>
        <p class="font-semibold text-xl">{departingSoonCount}</p>
      </div>
    </div>
    <p class="text-base-content/60 text-sm">
      {dayTypeLabel} · {updatedTime}
    </p>
    <BusMapActiveTripList
      {allRouteIds}
      {copy}
      bind:hoveredRoute
      {mapData}
      {nowMinutes}
    />
  </Card.Content>
</Card.Root>
