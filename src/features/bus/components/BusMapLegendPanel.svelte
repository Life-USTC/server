<script lang="ts">
import { routeColor } from "@/features/bus/components/bus-transit-map-layout";
import type { BusMapCopy, BusMapData } from "@/features/bus/lib/bus-map-types";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";

export let allRouteIds: number[];
export let copy: BusMapCopy;
export let hoveredRoute: number | null;
export let mapData: BusMapData;

function formatMessage(template: string, values: Record<string, string>) {
  return template.replace(
    /\{(\w+)}/g,
    (_match, key: string) => values[key] ?? "",
  );
}
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{copy.legend.title}</Card.Title>
    <Card.Action>
      <span class="text-muted-foreground text-xs">{copy.legendTrips}</span>
    </Card.Action>
  </Card.Header>
  <Card.Content>
    <ScrollArea class="h-[min(70vh,32rem)]">
      <Item.Group class="gap-1.5">
        {#each mapData.routes as route}
          <Item.Root
            class="items-start"
            size="sm"
            variant={hoveredRoute === route.routeId ? "muted" : "default"}
            onpointerenter={() => {
              hoveredRoute = route.routeId;
            }}
            onpointerleave={() => {
              hoveredRoute = null;
            }}
          >
            <Item.Media>
              <span class="h-2 w-8 rounded-full" style={`background:${routeColor(route.routeId, allRouteIds)}`}></span>
            </Item.Media>
            <Item.Content>
              <Item.Title>{route.descriptionPrimary}</Item.Title>
              <Item.Description class="line-clamp-none">
                {#each route.stops as stop, index}
                  <span>{index === 0 ? "" : "-> "}{stop.campusName}</span>
                {/each}
              </Item.Description>
            </Item.Content>
            <Item.Actions>
              <Badge variant="ghost">
                {formatMessage(copy.tripCount[mapData.todayType], {
                  count: String(mapData.todayType === "weekday" ? route.weekdayTrips : route.weekendTrips),
                })}
              </Badge>
            </Item.Actions>
          </Item.Root>
        {/each}
      </Item.Group>
    </ScrollArea>
  </Card.Content>
</Card.Root>
