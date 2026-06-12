<script lang="ts">
import type { BusApplicableRoute } from "@/features/bus/lib/bus-client";
import {
  busRouteSegmentStopColumns,
  busStopTimeLabel,
  busTripStopTimeForOrder,
} from "@/features/dashboard/lib/bus";
import * as Table from "$lib/components/ui/table/index.js";

export let busNextTripHighlightKey: string | null;
export let route: BusApplicableRoute;

$: stopColumns = busRouteSegmentStopColumns(route);
$: tableMinWidth = `${Math.max(16, stopColumns.length * 4.25)}rem`;
</script>

<section class="grid gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
  <h3 class="font-semibold">{route.route.descriptionPrimary}</h3>
  <div class="overflow-x-auto">
    <Table.Root style={`min-width: ${tableMinWidth};`}>
      <Table.Header>
        <Table.Row>
          {#each stopColumns as stop, index}
            <Table.Head
              class={index === 0
                ? "text-left"
                : index === stopColumns.length - 1
                  ? "text-right"
                  : "text-center"}
            >
              {stop.label}
            </Table.Head>
          {/each}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each route.visibleTrips as trip}
          {@const tripKey = `${route.route.id}:${trip.trip.id}`}
          {@const isNextTrip = tripKey === busNextTripHighlightKey}
          <Table.Row
            class={`border-0 ${trip.status === "departed" ? "opacity-60" : ""} ${
              isNextTrip ? "bg-base-200/70 hover:bg-base-200" : ""
            }`}
          >
            {#each stopColumns as stop, index}
              {@const stopTime = busTripStopTimeForOrder(trip, stop.stopOrder)}
              <Table.Cell
                class={`font-mono tabular-nums ${
                  index === 0
                    ? "text-left"
                    : index === stopColumns.length - 1
                      ? "text-right"
                      : "text-center"
                }`}
              >
                {busStopTimeLabel(stopTime)}
              </Table.Cell>
            {/each}
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
</section>
