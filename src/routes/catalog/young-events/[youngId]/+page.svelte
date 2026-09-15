<script lang="ts">
import YoungEventDetailPage from "@/features/young/components/YoungEventDetailPage.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.event?.name ?? data.copy.youngEvents.notFound} - Life@USTC</title>
</svelte:head>

{#if data.event}
  <YoungEventDetailPage
    commentsData={data.commentsData}
    copy={data.copy}
    event={data.event}
    source={data.source}
  />
{/if}
