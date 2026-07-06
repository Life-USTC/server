<script lang="ts">
import type { BusApplicableRoute } from "@/features/bus/lib/bus-client";
import {
  busRouteSegmentStopColumns,
  busStopTimeLabel,
  busTripStopTimeForOrder,
} from "@/features/dashboard/lib/bus";
import * as Card from "$lib/components/ui/card/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import { cn } from "$lib/utils.js";

export let busNextTripHighlightKey: string | null;
export let route: BusApplicableRoute;

$: stopColumns = busRouteSegmentStopColumns(route);
$: tableMinWidth = `${Math.max(16, stopColumns.length * 4.25)}rem`;
</script>

<section>
  <Card.Root>
    <Card.Header>
      <Card.Title>{route.route.descriptionPrimary}</Card.Title>
    </Card.Header>
    <Card.Content>
      <div style="--table-min-width: {tableMinWidth}">
        <Table.Root class="min-w-[var(--table-min-width)]">
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
                class={cn(
                  trip.status === "departed" ? "opacity-60" : undefined,
                  isNextTrip ? "bg-muted/70 hover:bg-muted" : undefined,
                )}
              >
                {#each stopColumns as stop, index}
                  {@const stopTime = busTripStopTimeForOrder(trip, stop.stopOrder)}
                  <Table.Cell
                    class={cn(
                      index === 0
                        ? "text-left"
                        : index === stopColumns.length - 1
                          ? "text-right"
                          : "text-center",
                    )}
                  >
                    <span class="font-mono tabular-nums">
                      {busStopTimeLabel(stopTime)}
                    </span>
                  </Table.Cell>
                {/each}
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    </Card.Content>
  </Card.Root>
</section>
