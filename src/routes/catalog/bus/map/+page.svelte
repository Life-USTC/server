<script lang="ts">
import { onMount } from "svelte";
import BusMapContent from "@/features/bus/components/BusMapContent.svelte";
import { REFRESH_MS } from "@/features/bus/components/bus-transit-map-layout";
import { invalidateAll } from "$app/navigation";
import type { PageData } from "./$types";

export let data: PageData;

let refreshing = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

$: copy = data.copy.busMap;

async function refreshMap() {
  refreshing = true;
  await invalidateAll();
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshing = false;
    refreshTimer = null;
  }, 800);
}

onMount(() => {
  const interval = setInterval(() => {
    void invalidateAll();
  }, REFRESH_MS);
  return () => {
    clearInterval(interval);
    if (refreshTimer) clearTimeout(refreshTimer);
  };
});
</script>

<svelte:head><title>{data.copy.metadata.busMap} - Life@USTC</title></svelte:head>

<BusMapContent
  {copy}
  dayTypeLabels={data.copy.busDayType}
  locale={data.locale}
  mapData={data.data}
  {refreshing}
  {refreshMap}
/>
