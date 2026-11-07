<script lang="ts">
import { routeColor } from "@/features/bus/components/bus-transit-map-layout";
import type {
  BusMapRouteEdge,
  BusMapRoutePath,
} from "@/features/bus/lib/bus-map-types";

export let activeRouteIds: Set<number>;
export let allRouteIds: number[];
export let hoveredRoute: number | null;
export let routes: BusMapRouteEdge[];
export let routePaths: Map<number, BusMapRoutePath>;

function routeOpacity(
  routeId: number,
  highlightedRoute: number | null,
  activeRoutes: Set<number>,
) {
  if (highlightedRoute == null) return activeRoutes.has(routeId) ? 0.95 : 0.78;
  return highlightedRoute === routeId ? 0.98 : 0.22;
}

function routeStrokeWidth(
  routeId: number,
  highlightedRoute: number | null,
  activeRoutes: Set<number>,
) {
  if (highlightedRoute === routeId) return 7;
  return activeRoutes.has(routeId) ? 5.5 : 4.5;
}
</script>

{#each routes as route}
  {@const routePath = routePaths.get(route.routeId)}
  {#if routePath?.path}
    <path
      d={routePath.path}
      stroke={routeColor(route.routeId, allRouteIds)}
      stroke-width="14"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
      opacity={hoveredRoute === route.routeId ? 0.18 : 0.06}
    />
  {/if}
{/each}
{#each routes as route}
  {@const routePath = routePaths.get(route.routeId)}
  {#if routePath?.path}
    <path
      d={routePath.path}
      stroke={routeColor(route.routeId, allRouteIds)}
      stroke-width={routeStrokeWidth(route.routeId, hoveredRoute, activeRouteIds)}
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
      opacity={routeOpacity(route.routeId, hoveredRoute, activeRouteIds)}
      stroke-dasharray={activeRouteIds.has(route.routeId) ? "8 5" : undefined}
      style={activeRouteIds.has(route.routeId) ? "animation: dash-march 0.8s linear infinite;" : ""}
      role="presentation"
      onmouseenter={() => {
        hoveredRoute = route.routeId;
      }}
    />
  {/if}
{/each}
