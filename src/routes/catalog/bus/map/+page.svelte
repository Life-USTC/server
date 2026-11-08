<script lang="ts">
import { onMount } from "svelte";
import BusMapContent from "@/features/bus/components/BusMapContent.svelte";
import { REFRESH_MS } from "@/features/bus/components/bus-transit-map-layout";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import { browser } from "$app/env";
import { invalidateAll } from "$app/navigation";
import type { PageData } from "./$types";

export let data: PageData;
const shellViewer = getShellViewer();
$: readable = !browser || Boolean(homePublicReadEpoch($shellViewer, data.demo));

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
    if (!data.demo && !$shellViewer.demo) void invalidateAll();
  }, REFRESH_MS);
  return () => {
    clearInterval(interval);
    if (refreshTimer) clearTimeout(refreshTimer);
  };
});
</script>

<svelte:head><title>{data.copy.metadata.busMap} - Life@USTC</title></svelte:head>

{#if data.demo}<DemoNotice demo={data.demo} locale={data.locale} /><p class="mb-4 text-sm" data-testid="demo-campus-fictional">{data.sampleNotice}</p>{/if}
{#if readable}
<BusMapContent
  {copy}
  dayTypeLabels={data.copy.busDayType}
  locale={data.locale}
  mapData={data.data}
  {refreshing}
  {refreshMap}
/>
{/if}
