<script lang="ts">
import YoungOrganizerDetailPage from "@/features/young/components/YoungOrganizerDetailPage.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.organizer?.name ?? data.copy.youngEvents.organizerNotFound} - Life@USTC</title>
</svelte:head>

{#if data.organizer}
  <YoungOrganizerDetailPage
    copy={data.copy}
    organizer={data.organizer}
    events={data.events}
    source={data.source}
  />
{/if}
