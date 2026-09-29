<script lang="ts">
import WeatherPage from "@/features/weather/components/WeatherPage.svelte";
import CollectionPage from "$lib/components/CollectionPage.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<svelte:head>
  <title>{data.copy.weather.title} - Life@USTC</title>
</svelte:head>

<CollectionPage description={data.copy.weather.description} panel={false} title={data.copy.weather.title}>
  <WeatherPage
    locations={data.locations}
    locale={data.locale}
    weatherCopy={data.copy.weather}
  />
</CollectionPage>
