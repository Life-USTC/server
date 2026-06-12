<script lang="ts">
import { routeColor } from "@/features/bus/components/bus-transit-map-layout";
import type { BusMapCopy, BusMapData } from "@/features/bus/lib/bus-map-types";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";

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
  <Card.Content class="grid gap-4 pt-5">
    <div class="flex items-center justify-between gap-3">
      <Card.Title class="text-base">{copy.legend.title}</Card.Title>
      <span class="text-base-content/60 text-xs">{copy.legendTrips}</span>
    </div>
    <ul class="grid max-h-[32rem] gap-1.5 overflow-y-auto">
      {#each mapData.routes as route}
        <li class={`rounded-md border px-2 py-1.5 text-sm transition ${hoveredRoute === route.routeId ? "border-base-300 bg-base-200/60" : "border-transparent hover:border-base-300 hover:bg-base-200/50"}`}>
          <div class="flex items-center gap-2">
            <span class="h-2 w-8 rounded-full" style={`background:${routeColor(route.routeId, allRouteIds)}`}></span>
            <button
              class="min-w-0 flex-1 truncate text-left font-medium focus:outline-none"
              type="button"
              onmouseenter={() => {
                hoveredRoute = route.routeId;
              }}
              onmouseleave={() => {
                hoveredRoute = null;
              }}
              onfocus={() => {
                hoveredRoute = route.routeId;
              }}
              onblur={() => {
                hoveredRoute = null;
              }}
            >
              {route.descriptionPrimary}
            </button>
            <Badge variant="ghost">
              {formatMessage(copy.tripCount[mapData.todayType], {
                count: String(mapData.todayType === "weekday" ? route.weekdayTrips : route.weekendTrips),
              })}
            </Badge>
          </div>
          <div class="mt-1 flex flex-wrap gap-1 pl-10 text-base-content/60 text-xs">
            {#each route.stops as stop, index}
              <span>{index === 0 ? "" : "-> "}{stop.campusName}</span>
            {/each}
          </div>
        </li>
      {/each}
    </ul>
  </Card.Content>
</Card.Root>
