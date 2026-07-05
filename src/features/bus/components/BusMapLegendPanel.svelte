<script lang="ts">
import { routeColor } from "@/features/bus/components/bus-transit-map-layout";
import type { BusMapCopy, BusMapData } from "@/features/bus/lib/bus-map-types";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
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
      <ul class="grid gap-1.5">
        {#each mapData.routes as route}
          <li
            class={`rounded-md border px-2 py-1.5 text-sm transition ${hoveredRoute === route.routeId ? "border-border bg-muted/60" : "border-transparent hover:border-border hover:bg-muted/50"}`}
            onpointerenter={() => {
              hoveredRoute = route.routeId;
            }}
            onpointerleave={() => {
              hoveredRoute = null;
            }}
          >
            <div class="flex items-center gap-2">
              <span class="h-2 w-8 rounded-full" style={`background:${routeColor(route.routeId, allRouteIds)}`}></span>
              <span class="min-w-0 flex-1 truncate text-left font-medium">
                {route.descriptionPrimary}
              </span>
              <Badge variant="ghost">
                {formatMessage(copy.tripCount[mapData.todayType], {
                  count: String(mapData.todayType === "weekday" ? route.weekdayTrips : route.weekendTrips),
                })}
              </Badge>
            </div>
            <div class="mt-1 flex flex-wrap gap-1 pl-10 text-muted-foreground text-xs">
              {#each route.stops as stop, index}
                <span>{index === 0 ? "" : "-> "}{stop.campusName}</span>
              {/each}
            </div>
          </li>
        {/each}
      </ul>
    </ScrollArea>
  </Card.Content>
</Card.Root>
