<script lang="ts">
import { routeColor } from "@/features/bus/components/bus-transit-map-layout";
import { cn } from "$lib/utils.js";

export let allRouteIds: number[];
export let routeId: number;
export let shape: "line" | "dot" = "line";

$: color = routeColor(routeId, allRouteIds);
</script>

<span
  aria-hidden="true"
  class={cn(
    "shrink-0 rounded-full",
    shape === "dot" ? "size-2.5" : "h-2 w-8",
  )}
  style={`background-color: ${color};`}
></span>
