<script lang="ts">
import YoungEventsPage from "@/features/young/components/YoungEventsPage.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.copy.youngEvents.title} - Life@USTC</title>
</svelte:head>

<YoungEventsPage
  categories={data.categories}
  copy={data.copy}
  data={data.data}
  filters={data.filters}
  pagination={data.pagination}
/>
