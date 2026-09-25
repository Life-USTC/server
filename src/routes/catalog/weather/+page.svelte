<script lang="ts">
import WeatherPage from "@/features/weather/components/WeatherPage.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import PageLayout from "$lib/components/PageLayout.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<svelte:head>
  <title>{data.copy.weather.title} - Life@USTC</title>
</svelte:head>

<PageLayout>
{#snippet header()}
  <PageHeader
    description={data.copy.weather.description}
    title={data.copy.weather.title}
  />
{/snippet}

  <WeatherPage
    locations={data.locations}
    locale={data.locale}
    weatherCopy={data.copy.weather}
  />
</PageLayout>
