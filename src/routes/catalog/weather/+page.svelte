<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import WeatherPage from "@/features/weather/components/WeatherPage.svelte";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import { browser } from "$app/env";
import type { PageData } from "./$types";

export let data: PageData;
const shellViewer = getShellViewer();
$: readable = !browser || Boolean(homePublicReadEpoch($shellViewer, data.demo));
</script>

<svelte:head>
  <title>{data.copy.weather.title} - Life@USTC</title>
</svelte:head>

<CollectionPage description={data.copy.weather.description} panel={false} title={data.copy.weather.title}>
  {#if data.demo}<DemoNotice demo={data.demo} locale={data.locale} /><p class="mb-4 text-sm" data-testid="demo-campus-fictional">{data.sampleNotice}</p>{/if}
  {#if readable}
  <WeatherPage
    locations={data.locations}
    locale={data.locale}
    weatherCopy={data.demo ? { ...data.copy.weather, updatedAt: `${data.demo.referenceTimeLabel}: {value}` } : data.copy.weather}
  />
  {/if}
</CollectionPage>
