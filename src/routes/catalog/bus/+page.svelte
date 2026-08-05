<script lang="ts">
import CatalogPageHeader from "@/features/catalog/components/CatalogPageHeader.svelte";
import BusTab from "@/features/dashboard/components/BusTab.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<svelte:head>
  <title>{data.copy.dashboard.nav.bus.title} - Life@USTC</title>
</svelte:head>

<section class="grid gap-5">
  <CatalogPageHeader
    description={data.copy.dashboard.nav.bus.description}
    title={data.copy.dashboard.nav.bus.title}
  />

  <BusTab
    busCopy={data.copy.bus}
    bus={data.bus}
    compact
    savePreferences={data.signedIn}
  />
</section>
