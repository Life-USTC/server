<script lang="ts">
import type { BusMapCopy, BusMapData } from "@/features/bus/lib/bus-map-types";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Item from "$lib/components/ui/item/index.js";
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
  <Card.Header>
    <Card.Title>{copy.statusTitle}</Card.Title>
    <Card.Action>
      <Badge variant="ghost">{dayTypeLabel}</Badge>
    </Card.Action>
  </Card.Header>
  <Card.Content class="grid gap-4">
    <Item.Group class="grid grid-cols-2 gap-2">
      <Item.Root class="items-start" variant="outline">
        <Item.Content>
          <Item.Description>{copy.legend.enRoute}</Item.Description>
          <Item.Title>{enRouteCount}</Item.Title>
        </Item.Content>
      </Item.Root>
      <Item.Root class="items-start" variant="outline">
        <Item.Content>
          <Item.Description>{copy.legend.departingSoon}</Item.Description>
          <Item.Title>{departingSoonCount}</Item.Title>
        </Item.Content>
      </Item.Root>
    </Item.Group>
    <p class="text-muted-foreground text-sm">
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
