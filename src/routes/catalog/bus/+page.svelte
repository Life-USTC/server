<script lang="ts">
import BusTab from "@/features/workspace/components/BusTab.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import PageLayout from "$lib/components/PageLayout.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<svelte:head>
  <title>{data.copy.workspace.nav.bus.title} - Life@USTC</title>
</svelte:head>

<PageLayout>
{#snippet header()}
  <PageHeader
    description={data.copy.workspace.nav.bus.description}
    title={data.copy.workspace.nav.bus.title}
  />
{/snippet}

  <BusTab
    busCopy={data.copy.bus}
    bus={data.bus}
    compact
    savePreferences={data.signedIn}
  />
</PageLayout>
