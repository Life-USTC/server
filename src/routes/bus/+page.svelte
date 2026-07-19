<script lang="ts">
import BusTab from "@/features/dashboard/components/BusTab.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<svelte:head>
  <title>{data.copy.dashboard.nav.bus.title} - Life@USTC</title>
</svelte:head>

<div class="mx-auto grid w-full max-w-7xl gap-5">
  <div class="grid gap-1">
    <p class="font-medium text-muted-foreground text-sm">
      {data.copy.homepage.publicDashboard.title}
    </p>
    <h1 class="font-semibold text-2xl tracking-normal sm:text-3xl">
      {data.copy.dashboard.nav.bus.title}
    </h1>
    <p class="max-w-3xl text-muted-foreground text-sm">
      {data.copy.dashboard.nav.bus.description}
    </p>
  </div>

  <BusTab busCopy={data.copy.bus} bus={data.bus} compact />
</div>
