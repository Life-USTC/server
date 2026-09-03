<script lang="ts">
import WeatherPage from "@/features/weather/components/WeatherPage.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<svelte:head>
  <title>{data.copy.weather.title} - Life@USTC</title>
</svelte:head>

<section class="grid gap-5">
  <PageHeader
    description={data.copy.weather.description}
    title={data.copy.weather.title}
  />

  <WeatherPage
    locations={data.locations}
    locale={data.locale}
    weatherCopy={data.copy.weather}
  />
</section>
